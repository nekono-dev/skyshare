/**
 * PostCard 1件分の skyshare entry 作成・削除状態を一元管理するフック。
 *
 * 責務と処理概要:
 * - 「entry の有無」と「進行中の操作（作成中/削除中）」を単一の state にまとめ、
 *   複数の独立した boolean を組み合わせて導出する方式では起こり得た
 *   矛盾した組み合わせ（例: entry は削除済みなのに作成済みフラグが残る）を構造的に排除する。
 * - 呼び出し側（PostCardEntryActions）はこのフックが返す `display` の種別だけを見れば
 *   ボタン表示を切り替えられる。
 */
import { useRef, useState } from "react"
import { createEntry, deleteEntry, getBskyImage } from "@/client/openapi/client"
import { createDefaultThumbnail } from "@/lib/image/postImageProcessing"
import type { TimelinePost, TimelineSkyshareEntry } from "@/lib/entry/posts"

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
    createError: string | null
    deleteError: string | null
    isDeleteDialogOpen: boolean
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
     */
    onPostDeleted?: () => void
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
    const [state, setState] = useState<InternalState>(() => ({
        phase: "idle",
        entry: item.skyshareEntry ?? null,
    }))
    const [createError, setCreateError] = useState<string | null>(null)
    const [deleteError, setDeleteError] = useState<string | null>(null)
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
    // 連打時、state 更新の再レンダーが反映される前に多重リクエストが走るのを防ぐため、
    // 同期的に確定する ref で即座にガードする。
    const isCreatingRef = useRef(false)
    const isDeletingRef = useRef(false)

    const hasImages = item.images.length > 0

    const display: SkyshareEntryDisplayState =
        state.phase === "creating"
            ? { kind: "creating" }
            : state.phase === "deleting"
              ? { kind: "deleting", entry: state.entry }
              : state.entry
                ? { kind: "entry", entry: state.entry }
                : hasImages
                  ? { kind: "creatable" }
                  : { kind: "ineligible" }

    /**
     * 既存の Bluesky 投稿から skyshare entry を発行する。
     *
     * 処理の趣旨:
     * - 元投稿の全画像を `GET /v2/bsky/images`（同一オリジン、cdn.bsky.appのCORS制約を
     *   回避するためのBluesky APIバイパスAPI）経由で取得し、投稿フォームでクロップ編集
     *   しなかった場合と同じデフォルト配置（`createDefaultThumbnail`）でユーザから見えない
     *   Canvas上に合成してから送信する。
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
            const objectUrls: string[] = []
            try {
                objectUrls.push(
                    ...(await Promise.all(
                        item.images.map(async image => {
                            const res = await getBskyImage({ cid: image.cid })
                            if (
                                res.status !== 200 ||
                                !(res.data instanceof Blob)
                            ) {
                                throw new Error("元画像の取得に失敗しました。")
                            }
                            return URL.createObjectURL(res.data)
                        }),
                    )),
                )

                const thumbnailBlob = await createDefaultThumbnail(objectUrls)
                const res = await createEntry({
                    uri: item.uri,
                    ogImage: thumbnailBlob,
                })
                if (res.status !== 200) {
                    setCreateError("skyshareページの作成に失敗しました。")
                    setState({ phase: "idle", entry: null })
                    return
                }

                const { skyshare } = res.data
                if (!skyshare.atUri) {
                    setCreateError("skyshareページの作成に失敗しました。")
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
                setState({ phase: "idle", entry })
                options.onCreated?.(entry)
            } catch (err) {
                console.error("PostCard: failed to create skyshare entry", err)
                setCreateError("skyshareページの作成に失敗しました。")
                setState({ phase: "idle", entry: null })
            } finally {
                objectUrls.forEach(url => URL.revokeObjectURL(url))
                isCreatingRef.current = false
            }
        })()
    }

    /**
     * Entry削除確認ダイアログを開く。
     *
     * Output:
     * - なし（`isDeleteDialogOpen` を true にする）
     */
    const requestDeleteEntry = () => {
        if (isDeletingRef.current || state.phase !== "idle" || !state.entry) {
            return
        }
        setIsDeleteDialogOpen(true)
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
                const res = await deleteEntry({
                    uri: entry.uri,
                    deleteBskyPost,
                })
                if (res.status !== 200) {
                    setDeleteError("Entryの削除に失敗しました。")
                    setState({ phase: "idle", entry })
                    return
                }

                setState({ phase: "idle", entry: null })
                if (deleteBskyPost) {
                    // サーバーはBluesky投稿削除の成否に関わらず200を返す仕様
                    // （src/pages/v2/entry.ts DELETEハンドラ）のため、200が返った時点で
                    // 削除確定とみなしてTimeline側にカード除去を通知する。
                    options.onPostDeleted?.()
                }
            } catch (err) {
                console.error("PostCard: failed to delete skyshare entry", err)
                setDeleteError("Entryの削除に失敗しました。")
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
        createEntryFromPost,
        requestDeleteEntry,
        cancelDeleteEntry,
        confirmDeleteEntry,
    }
}
