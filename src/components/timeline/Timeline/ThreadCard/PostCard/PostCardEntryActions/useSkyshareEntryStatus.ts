/**
 * 投稿に紐づく Entry の作成・削除状態と削除確認範囲を管理する。
 * 単一の状態判別子で保持し、Entry の有無と進行中操作が矛盾する状態を作らない。
 */
import type { PlainMessageKey } from "@/lib/i18n/translate"
import { useRef, useState } from "react"
import { createEntry, deleteEntry } from "@/client/openapi/client"
import { createPostVisualBlob } from "@/lib/entry/createPostVisual"
import { getActiveAccountDisplayName } from "@/lib/session/activeAccountSession"
import { buildEntryText } from "@/lib/entry/entryText"
import { warmOgpCache } from "@/lib/entry/warmOgpCache"
import { waitForImageLoad } from "@/util/waitForImageLoad"
import {
    resolveEntryDeleteScope,
    type EntryDeleteScope,
} from "@/lib/timeline/resolveEntryDeleteScope"
import { resolveGuestDeleteScope } from "@/lib/guestMode"
import { useT } from "@/components/i18n/useTranslation"
import {
    hasEntryMedia,
    type TimelinePost,
    type TimelineSkyshareEntry,
} from "@/lib/timeline/posts"

/**
 * PostCard の Entry 関連 UI が参照する、その時点で確定している唯一の表示状態。
 */
export type SkyshareEntryDisplayState =
    | { kind: "ineligible" }
    | { kind: "creatable" }
    | { kind: "creating" }
    | { kind: "entry"; entry: TimelineSkyshareEntry }
    | { kind: "deleting"; entry: TimelineSkyshareEntry }

type InternalState =
    | { phase: "idle"; entry: TimelineSkyshareEntry | null }
    | { phase: "creating" }
    | { phase: "deleting"; entry: TimelineSkyshareEntry }

export type UseSkyshareEntryStatusResult = {
    display: SkyshareEntryDisplayState
    createError: PlainMessageKey | null
    deleteError: PlainMessageKey | null
    isDeleteDialogOpen: boolean
    /** 削除範囲を判定中か */
    isResolvingDeleteScope: boolean
    /** 削除確認ダイアログに渡す削除範囲の判定結果 */
    deleteScope: EntryDeleteScope
    createEntryFromPost: () => void
    requestDeleteEntry: () => void
    cancelDeleteEntry: () => void
    confirmDeleteEntry: (deleteBskyPost: boolean) => void
}

type Options = {
    /** 作成成功直後（共有ダイアログを開く等）に呼び出す副作用 */
    onCreated?: (entry: TimelineSkyshareEntry) => void
    /**
     * Bluesky投稿ごと削除された直後に呼び出す副作用。
     * リンクのみ削除（deleteBskyPost=false）の場合は呼ばれない
     * （元投稿はTimelineに残り続けるため）。
     * Timeline のページング単位に合わせ、呼び出し元はスレッドグループ全体を一覧から除く。
     */
    onPostDeleted?: () => void
    /**
     * 事後entry作成のVisual（カバー画像）を`item`の代わりに取得する投稿。
     * スレッドではルートに最も近い画像付き投稿を指定する。未指定時は item 自身を使う。
     */
    visualSourcePost?: TimelinePost
    /**
     * 作成するentryの`source`にする投稿。APIへ送信する`uri`に使う
     * Visual 取得元とは独立して指定する。サーバーは source を自動解決しないため、
     * スレッドでは呼び出し元がルート投稿を渡す。未指定時は item 自身を使う。
     */
    sourcePost?: TimelinePost
    /**
     * ゲスト表示では削除範囲の判定と削除をアプリ内で模擬し、通信しない。
     */
    guestMode?: boolean
}

/**
 * 1件の投稿に紐づく skyshare entry の作成・削除状態を管理する。
 *
 * Input:
 * - `item`: 対象投稿（entry 作成/削除 API の呼び出し先と、初期表示状態の判定に使う）
 * - `options.onCreated`: 作成成功時に発行済み entry を渡すコールバック
 *
 * Output:
 * - `display`: 現在の表示状態（ineligible/creatable/creating/entry/deleting）
 * - `createError`/`deleteError`: 直近の操作エラーメッセージ
 * - `createEntryFromPost`: 作成ボタンの onClick から呼び出す実行関数
 * - `requestDeleteEntry`/`cancelDeleteEntry`/`confirmDeleteEntry`: 削除確認ダイアログの開閉・確定を行う関数
 */
export const useSkyshareEntryStatus = (
    item: TimelinePost,
    options: Options = {},
): UseSkyshareEntryStatusResult => {
    const translator = useT()
    const [state, setState] = useState<InternalState>(() => ({
        phase: "idle",
        entry: item.skyshareEntry ?? null,
    }))
    const [createError, setCreateError] = useState<PlainMessageKey | null>(null)
    const [deleteError, setDeleteError] = useState<PlainMessageKey | null>(null)
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
    const [isResolvingDeleteScope, setIsResolvingDeleteScope] = useState(false)
    const [deleteScope, setDeleteScope] = useState<EntryDeleteScope>({
        kind: "unknown",
    })
    // 連打時、state 更新の再レンダーが反映される前に多重リクエストが走るのを防ぐため、
    // 同期的に確定する ref で即座にガードする。
    const isCreatingRef = useRef(false)
    const isDeletingRef = useRef(false)
    const isResolvingDeleteScopeRef = useRef(false)

    const visualSource = options.visualSourcePost ?? item
    const sourcePost = options.sourcePost ?? item
    const hasEntryVisualMedia = hasEntryMedia(visualSource)

    const display: SkyshareEntryDisplayState =
        state.phase === "creating"
            ? { kind: "creating" }
            : state.phase === "deleting"
              ? { kind: "deleting", entry: state.entry }
              : state.entry
                ? { kind: "entry", entry: state.entry }
                : hasEntryVisualMedia
                  ? { kind: "creatable" }
                  : { kind: "ineligible" }

    /**
     * 既存の Bluesky 投稿から skyshare entry を発行する。
     *
     * 処理の趣旨:
     * - Visual取得元投稿（`visualSourcePost`指定時はそちら、未指定なら`item`自身）から
     *   `createPostVisualBlob`（`@/lib/entry/createPostVisual`）でvisualを作る。
     *   画像投稿は先頭`VISUAL_IMAGE_COUNT`枚を投稿フォームでクロップ編集しなかった場合と
     *   同じデフォルト配置で合成し、動画投稿はposterに再生ボタンを重ねる（再生時間はheadingに記載する）。
     *   素材・再生時間の取得に失敗したら、entryは作成せず作成失敗として扱う。
     * - APIに渡す`uri`（entryの`source`）はVisual取得元とは独立に`sourcePost`
     *   （未指定なら`item`自身）を使う。Visual取得元がスレッドの後続投稿でも、
     *   サーバは`source`を自動解決しないため、entryは常に`sourcePost`に紐づく。
     *
     * Output:
     * - なし（成功時は state を entry ありへ遷移し `onCreated` を呼ぶ）
     */
    const createEntryFromPost = () => {
        if (isCreatingRef.current || state.phase !== "idle" || state.entry) {
            return
        }

        isCreatingRef.current = true
        setState({ phase: "creating" })
        setCreateError(null)

        void (async () => {
            try {
                const { blob: thumbnailBlob, videoDurationSec } =
                    await createPostVisualBlob(visualSource)
                const userName = await getActiveAccountDisplayName()
                if (userName === null) {
                    setCreateError("post.entry.createFailed")
                    setState({ phase: "idle", entry: null })
                    return
                }
                // サーバーは heading/caption を生成しないため、source 投稿から組み立てて送る。
                const entryText = buildEntryText({
                    userName,
                    postText: sourcePost.text,
                    videoDurationSec,
                })
                const res = await createEntry({
                    uri: sourcePost.uri,
                    visual: thumbnailBlob,
                    ...entryText,
                })
                if (res.status !== 200) {
                    setCreateError("post.entry.createFailed")
                    setState({ phase: "idle", entry: null })
                    return
                }

                const skyshare = res.data.skyshareEntry
                if (!skyshare?.atUri) {
                    setCreateError("post.entry.createFailed")
                    setState({ phase: "idle", entry: null })
                    return
                }

                const entry: TimelineSkyshareEntry = {
                    uri: skyshare.atUri,
                    cid: skyshare.cid ?? "",
                    createdAt: skyshare.createdAt ?? new Date().toISOString(),
                    sourceUri: skyshare.sourceUri ?? item.uri,
                    sourceCid: skyshare.sourceCid ?? item.cid,
                    heading: skyshare.heading,
                    caption: skyshare.caption,
                    visualUrl: skyshare.visualUrl,
                    webUrl: skyshare.uri,
                }

                await warmOgpCache(skyshare.uri)
                // 詳細ページで visual を読み込める状態になるまで作成中表示を続ける。
                await waitForImageLoad(skyshare.visualUrl ?? "")

                setState({ phase: "idle", entry })
                options.onCreated?.(entry)
            } catch (err) {
                console.error("PostCard: failed to create skyshare entry", err)
                setCreateError("post.entry.createFailed")
                setState({ phase: "idle", entry: null })
            } finally {
                isCreatingRef.current = false
            }
        })()
    }

    /**
     * Entry削除確認ダイアログを開く。
     *
     * 処理の趣旨:
     * - 削除範囲と件数を確定してからダイアログを開く。ゲスト表示では通信せず
     *   `resolveGuestDeleteScope` で判定する。
     * - 判定中は`isResolvingDeleteScope`をtrueにし、連打による多重判定を防ぐ。
     *
     * Output:
     * - なし（判定完了後、`isDeleteDialogOpen`をtrueにする）
     */
    const requestDeleteEntry = () => {
        if (
            isDeletingRef.current ||
            isResolvingDeleteScopeRef.current ||
            state.phase !== "idle" ||
            !state.entry
        ) {
            return
        }
        const entry = state.entry

        isResolvingDeleteScopeRef.current = true
        setIsResolvingDeleteScope(true)

        void (async () => {
            try {
                const scope = await (options.guestMode
                    ? Promise.resolve(
                          resolveGuestDeleteScope(entry.sourceUri, translator),
                      )
                    : resolveEntryDeleteScope(entry.sourceUri))
                setDeleteScope(scope)
                setIsDeleteDialogOpen(true)
            } finally {
                isResolvingDeleteScopeRef.current = false
                setIsResolvingDeleteScope(false)
            }
        })()
    }

    /**
     * Entry削除確認ダイアログを閉じる（削除を実行しない）。
     */
    const cancelDeleteEntry = () => {
        setIsDeleteDialogOpen(false)
    }

    /**
     * skyshare entry を削除する。
     *
     * Input:
     * - `deleteBskyPost`: true の場合、紐づく Bluesky 投稿も併せて削除する
     * - ゲスト表示では`deleteEntry`を呼ばず、成功時と同じ状態遷移のみ行う
     *
     * Output:
     * - なし（成功時は state を entry なしへ遷移する）
     */
    const confirmDeleteEntry = (deleteBskyPost: boolean) => {
        if (isDeletingRef.current || state.phase !== "idle" || !state.entry) {
            return
        }
        const entry = state.entry

        setIsDeleteDialogOpen(false)
        isDeletingRef.current = true
        setState({ phase: "deleting", entry })
        setDeleteError(null)

        void (async () => {
            try {
                if (!options.guestMode) {
                    const res = await deleteEntry({
                        uri: entry.uri,
                        deleteBskyPost,
                    })
                    if (res.status !== 200) {
                        setDeleteError(
                            res.status === 409
                                ? "post.entry.deleteBlocked"
                                : "post.entry.deleteFailed",
                        )
                        setState({ phase: "idle", entry })
                        return
                    }
                }

                setState({ phase: "idle", entry: null })
                if (deleteBskyPost) {
                    // API は Bluesky 投稿削除の成否にかかわらず 200 を返すため、応答を受けたら一覧から除く。
                    options.onPostDeleted?.()
                }
            } catch (err) {
                console.error("PostCard: failed to delete skyshare entry", err)
                setDeleteError("post.entry.deleteFailed")
                setState({ phase: "idle", entry })
            } finally {
                isDeletingRef.current = false
            }
        })()
    }

    return {
        display,
        createError,
        deleteError,
        isDeleteDialogOpen,
        isResolvingDeleteScope,
        deleteScope,
        createEntryFromPost,
        requestDeleteEntry,
        cancelDeleteEntry,
        confirmDeleteEntry,
    }
}
