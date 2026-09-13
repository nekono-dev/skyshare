/**
 * 投稿フォーム（スレッド投稿対応）コンポーネント。
 *
 * 責務と処理概要:
 * - スレッド投稿のセグメント配列（`segments`）と現在編集中のセグメント（`activeIndex`）を
 *   管理する。単発投稿はセグメント数1件のケースとして同一のコンポーネントが扱う
 *   （`specs/threadpost/design.md §4.1`。以前の単発投稿専用`PostForm`はこの
 *   コンポーネントへ一般化され、独立した存在ではなくなった）。
 * - 各セグメントの入力補助UI（本文欄・画像・OGP・返信/引用設定・自己ラベル・言語選択）は
 *   `ThreadSegmentForm`に委譲し、本体はセグメント配列の管理・共有系トグルの永続化・
 *   下書き一覧・投稿成功後のポップアップ/WebShareAPI分岐の呼び出しに専念する。
 * - クロスポスト（自動ポップアップ・WebShareAPI）は先頭（1件目）セグメントのみを
 *   対象とする（2件目以降は対象外）。仕様書に明記が無かったため実装時に決定した方針。
 * - API送信は`submitThread`、投稿成功後のポップアップ/WebShareAPI分岐は`shareDispatch`に
 *   それぞれ委譲する。
 */
import React, {
  forwardRef,
  useEffect,
  useId,
  useImperativeHandle,
  useRef,
  useState,
} from "react"
import { RichText } from "@atproto/api"
import {
  createDraft,
  deleteDraft,
  getDrafts,
  updateDraft,
} from "@/client/openapi/client"
import Collapsible from "@/components/common/Collapsible/index"
import DraftListPanel from "@/components/entry/DraftListPanel"
import DraftSaveConfirmDialog from "@/components/entry/DraftSaveConfirmDialog"
import InlineIcon from "@/components/common/InlineIcon"
import Loading from "@/components/common/Loading"
import Overlay from "@/components/common/Overlay"
import ToggleSwitch from "@/components/common/ToggleSwitch"
import { extractTagsFromFacets } from "@/lib/atproto/richtext"
import { MAX_THREAD_POST_COUNT } from "@/lib/atproto/post"
import { addHashtagsToHistory } from "@/lib/settings/hashtagHistorySettings"
import { normalizeDraftList } from "@/lib/entry/draftList"
import {
  readPostGateDefaultSetting,
  readSyncGateDefaultAfterPostSetting,
  writePostGateDefaultSetting,
  writeSyncGateDefaultAfterPostSetting,
} from "@/lib/settings/postGateSettings"
import {
  readPinnedFormDisabledSetting,
  writePinnedFormDisabledSetting,
} from "@/lib/settings/shareSettings"
import {
  readHashtagSuggestEnabledSetting,
  readMentionSuggestEnabledSetting,
} from "@/lib/settings/suggestSettings"
import { buildIntentText, openIntentPopupFor } from "@/util/share/intent"
import { preOpenPopupWindow } from "@/util/share/openIntentPopup"
import { runShareDispatch } from "./shareDispatch"
import { submitThread } from "./submitThread"
import { useShareToggles } from "@/lib/settings/useShareToggles"
import ThreadSegmentForm from "./ThreadSegmentForm"
import {
  addSegment,
  canRemoveSegment,
  createEmptySegment,
  draftPostsToSegments,
  removeSegment,
  revokeImageEntry,
  segmentsToDraftPosts,
  type SegmentState,
} from "./segments"
import styles from "./index.module.css"
import ui from "@/styles/ui.module.css"

type Props = {
  /**
   * "dialog": PostLauncher の Overlay に埋め込まれるモーダル表示（既定値）。
   * "page": ページに常時表示する単独フォーム（post.astro 等）。dialog専用の
   * role="dialog"/aria-labelとキャンセルボタンを省く。
   */
  variant?: "dialog" | "page"
  onClose?: () => void
  onPosted?: () => void
  avatarUrl?: string | null
  /** ハッシュタグ履歴（`hashtagHistorySettings.ts`）をアカウント別に分けるための識別子 */
  accountDid?: string | null
  /**
   * 「投稿フォームを固定表示しない」設定が変更されたときに呼ばれる。
   * タイムライン先頭の常時表示フォームとフローティングボタン側のモーダルフォームが
   * 同一ページに同時に存在しうるため、片方での変更をもう片方の表示制御へ即時反映する用途。
   */
  onPinnedFormDisabledChange?: (next: boolean) => void
  /**
   * ログイン不要のゲスト用デモ表示。Bluesky認証セッションに依存する下書き機能は
   * 無効化する一方、投稿ボタンはBlueskyへの実投稿（submitThread）だけをスキップし、
   * その後の自動ポップアップ・WebShareAPI・X/タイッツー/Mastodon投稿ボタン等の
   * 後続処理は通常時と同じフローで実行して見た目を体験してもらう用途。
   */
  guestMode?: boolean
}

/**
 * 親（PostLauncher の Overlay など）から閉じ操作を要求するための命令的ハンドル。
 */
export type ThreadComposerHandle = {
  requestClose: () => void
}

type LoadedDraft = {
  id: string
  posts: ReturnType<typeof segmentsToDraftPosts>
}

/**
 * 投稿確定後、本文中のハッシュタグをローカル履歴（`hashtagHistorySettings.ts`）へ記録する。
 *
 * 処理の趣旨:
 * - 候補機能（`useSuggest`）のハッシュタグ候補は、Bluesky公開APIのグローバルなトレンドだけでは
 *   賄えないため、このブラウザで過去に自分が使ったタグを補う目的でここに記録する。
 * - facet抽出に失敗しても投稿フロー自体は継続させたいため、例外を握りつぶす。
 *
 * Input:
 * - `text`: 投稿本文
 * - `accountDid`: 履歴を分離するアカウントの識別子。未解決なら記録しない
 *
 * Output:
 * - なし
 */
const recordUsedHashtagsToHistory = (
  text: string,
  accountDid: string | null | undefined,
) => {
  try {
    const rt = new RichText({ text })
    rt.detectFacetsWithoutResolution()
    const tags = extractTagsFromFacets(rt.facets)
    addHashtagsToHistory(tags, accountDid)
  } catch (err) {
    console.warn("ThreadComposer: failed to record hashtag history", err)
  }
}

/**
 * 共有オプション折りたたみの初期開閉状態を決める。
 *
 * Input:
 * - `optionsList`: 共有系トグルの現在値一覧
 *
 * Output:
 * - 初回表示時に折りたたみを開くべきなら `true`
 */
const resolveShareOptionsDefaultOpen = ({
  optionsList,
}: {
  optionsList: boolean[]
}) => {
  return optionsList.some(Boolean)
}

/**
 * 投稿フォーム本体（スレッド投稿対応）を描画する。
 *
 * Input:
 * - `onClose`: フォームクローズ時コールバック
 * - `avatarUrl`: 表示用アバター URL
 *
 * Output:
 * - スレッド投稿対応の投稿入力 UI 一式
 */
export const Component = forwardRef<ThreadComposerHandle, Props>(
  function ThreadComposer(
    {
      variant = "dialog",
      onClose,
      onPosted,
      avatarUrl,
      accountDid,
      onPinnedFormDisabledChange,
      guestMode = false,
    },
    ref,
  ) {
    // ThreadComposerは常時表示のpinned form（Timeline）とPostLauncherのモーダルとで
    // 同一ページに複数インスタンスが同時にマウントされうる。id="entry-form"を
    // 固定文字列のままにすると、投稿ボタン(`form`属性で外部のform要素を参照)が
    // DOM上で先に出現する別インスタンスのform要素に誤って結びつき、
    // クリックしたのとは別インスタンスのsegments state（空のことが多い）で
    // 投稿されてしまう。インスタンスごとに一意なidにすることでこれを防ぐ。
    const entryFormId = useId()
    const [languageCode, setLanguageCode] = useState("ja")
    const [segments, setSegments] = useState<SegmentState[]>(() => [
      createEmptySegment("ja"),
    ])
    const [activeIndex, setActiveIndex] = useState(0)
    const shareToggles = useShareToggles()
    // useShareToggles はハイドレーション不一致を避けるため、マウント直後は
    // 共有系トグルを全てfalse固定で返し、実際の値はマウント後のuseEffectで非同期に
    // 反映する。Collapsible の defaultOpen は初回マウント時のみ評価される
    // （内部 state の初期化関数のため）ので、そのままでは常にfalseの仮値を見て
    // 折りたたんだ状態になってしまう。トグルの読み込み完了を検知して
    // Collapsible の key を変えることで、正しい値が揃った時点で再マウント
    // させ、defaultOpen を正しく再評価させる。
    const [shareTogglesReady, setShareTogglesReady] = useState(false)
    useEffect(() => {
      setShareTogglesReady(true)
    }, [])
    // SSRは常にfalseでレンダリングするため、初期stateもfalse固定にし、実際の設定値は
    // マウント後のuseEffectで反映する（shareTogglesReadyと同じ理由によるhydration
    // mismatch対策）。
    const [pinnedFormDisabled, setPinnedFormDisabled] = useState(false)
    useEffect(() => {
      setPinnedFormDisabled(readPinnedFormDisabledSetting(false))
    }, [])
    const [hashtagSuggestEnabled] = useState(() =>
      readHashtagSuggestEnabledSetting(true),
    )
    const [mentionSuggestEnabled] = useState(() =>
      readMentionSuggestEnabledSetting(true),
    )

    // マウント時、および astro:page-load（View Transitions遷移でDOM/Reactインスタンスが
    // 再マウントされずに使い回された場合）のたびに、返信・引用設定のデフォルト値・
    // 同期トグルをlocalStorageから読み直す。「画面を開いた時は常に最後に編集された
    // デフォルト値」を実現するための再読込であり、`Settings`コンポーネントの
    // reloadRefパターンと同じ趣旨。先頭セグメントの返信/引用設定にのみ反映する
    // （ルートセグメントの設定を「デフォルト」として扱う既存の考え方を踏襲）。
    const [syncGateDefaultAfterPost, setSyncGateDefaultAfterPost] = useState(
      () => readSyncGateDefaultAfterPostSetting(false),
    )
    useEffect(() => {
      const reload = () => {
        const defaultGate = readPostGateDefaultSetting()
        setSegments(prev =>
          prev.map((s, i) => (i === 0 ? { ...s, postGate: defaultGate } : s)),
        )
        setSyncGateDefaultAfterPost(readSyncGateDefaultAfterPostSetting(false))
      }
      reload()
      document.addEventListener("astro:page-load", reload)
      return () => document.removeEventListener("astro:page-load", reload)
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])
    const [status, setStatus] = useState<string | null>(null)
    const [statusColor, setStatusColor] = useState<string | undefined>(
      undefined,
    )
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [draftModalOpen, setDraftModalOpen] = useState(false)
    const [draftItems, setDraftItems] = useState<
      ReturnType<typeof normalizeDraftList>
    >([])
    const [draftListLoading, setDraftListLoading] = useState(false)
    const [draftListError, setDraftListError] = useState<string | null>(null)
    const [loadedDraft, setLoadedDraft] = useState<LoadedDraft | null>(null)
    const [draftSaveConfirmOpen, setDraftSaveConfirmOpen] = useState(false)
    const [isSavingDraft, setIsSavingDraft] = useState(false)
    const formRef = useRef<HTMLDivElement>(null)
    const entryFormRef = useRef<HTMLFormElement>(null)

    const rootSegment = segments[0]
    const hasTextInput = segments.some(s => s.text.trim().length > 0)
    const isThread = segments.length > 1

    // ボタンは自動ポップアップの代わりに手動で投稿する手段のため、
    // NoAutoPopupAfterPost が ON（自動ポップアップ抑制中）の場合のみ表示する。
    // クロスポスト先のトグル（taittsuu/mastodon）がONでもNoAutoPopupAfterPost OFF
    // （＝当該SNSへ自動ポップアップ中）の間はボタン表示は不要な点に注意。
    // クロスポストは先頭セグメントのみを対象とする（実装時に決定、design.md参照）。
    const showXIntentButton =
      shareToggles.showXWhenCrosspost && shareToggles.noAutoPopupAfterPost
    const showTaittsuuIntentButton =
      shareToggles.crosspostToTaittsuu && shareToggles.noAutoPopupAfterPost
    const showMastodonIntentButton =
      shareToggles.crosspostToMastodon && shareToggles.noAutoPopupAfterPost
    const defaultOpenShareOptions = resolveShareOptionsDefaultOpen({
      optionsList: [
        pinnedFormDisabled,
        shareToggles.crosspostToTaittsuu,
        shareToggles.showXWhenCrosspost,
        shareToggles.crosspostToMastodon,
      ],
    })

    /**
     * 投稿フォームの入力項目（全セグメント・下書き紐付け）のみを初期状態へ戻す。
     * status/statusColor は触らない（投稿成功メッセージ表示と両立させるため）。
     *
     * 処理の趣旨:
     * - `postGate`（返信/引用設定）は「投稿後にデフォルト値を更新する」トグルの状態に
     *   よって別途決定される値のため、呼び出し側で明示的に渡してもらう
     *   （このフォームインスタンス内で設定を持ち越す/都度デフォルトへ戻す、の
     *   いずれの挙動にも対応できるようにするため）。
     *
     * Input:
     * - `rootPostGate`: リセット後の先頭セグメントに設定する返信/引用設定
     *
     * Output:
     * - なし
     */
    const resetInputFields = (rootPostGate: SegmentState["postGate"]) => {
      segments.forEach(segment => revokeImageEntry(segment.imageEntry))
      setSegments([
        { ...createEmptySegment(languageCode), postGate: rootPostGate },
      ])
      setActiveIndex(0)
      setLoadedDraft(null)
    }

    /**
     * 下書き一覧を取得して選択ダイアログを開く。
     *
     * Input:
     * - なし
     *
     * Output:
     * - なし（state 更新のみ）
     */
    const openDraftPicker = async () => {
      setDraftModalOpen(true)
      setDraftListLoading(true)
      setDraftListError(null)

      try {
        const res = await getDrafts({ limit: 100 })
        if (res.status !== 200) {
          setDraftItems([])
          setDraftListError("下書き一覧の取得に失敗しました。")
          return
        }

        setDraftItems(normalizeDraftList(res.data.drafts))
      } catch (error) {
        console.error("ThreadComposer: failed to load drafts", error)
        setDraftItems([])
        setDraftListError("下書き一覧の取得に失敗しました。")
      } finally {
        setDraftListLoading(false)
      }
    }

    /**
     * 選択した下書きをフォームに反映する（スレッド全体を`segments`配列として復元する）。
     *
     * Input:
     * - `draft`: 下書き一覧の 1 レコード
     *
     * Output:
     * - なし（フォームの state を更新）
     */
    const applyDraftToForm = (
      draft: ReturnType<typeof normalizeDraftList>[number],
    ) => {
      segments.forEach(segment => revokeImageEntry(segment.imageEntry))
      const restored = draftPostsToSegments(draft.posts, languageCode)
      const nextSegments =
        restored.length > 0 ? restored : [createEmptySegment(languageCode)]
      setSegments(nextSegments)
      setActiveIndex(0)
      setLoadedDraft({
        id: draft.id,
        posts: segmentsToDraftPosts(nextSegments),
      })
      setStatus("下書きを反映しました。")
      setStatusColor("green")
    }

    /**
     * 投稿成功後、使用済みの下書きをバックグラウンドで削除する。
     *
     * Input:
     * - `draftId`: 削除対象の下書き ID
     *
     * Output:
     * - なし
     */
    const deleteDraftSilently = async (draftId: string) => {
      try {
        const res = await deleteDraft({ id: draftId })
        if (res.status !== 200) {
          console.error("ThreadComposer: failed to delete draft after posting")
        }
      } catch (error) {
        console.error(
          "ThreadComposer: failed to delete draft after posting",
          error,
        )
      }
    }

    /**
     * 現在の入力内容が、開いている下書きから変更されているかを判定する。
     *
     * Input:
     * - なし（`segments`/`loadedDraft` を参照）
     *
     * Output:
     * - 未保存の変更があれば `true`
     */
    const hasUnsavedDraftChanges = (): boolean => {
      if (!hasTextInput) return false
      if (!loadedDraft) return true
      const currentPosts = segmentsToDraftPosts(segments)
      return JSON.stringify(currentPosts) !== JSON.stringify(loadedDraft.posts)
    }

    /**
     * 下書きを保存(新規作成/更新)してからフォームを閉じる。
     *
     * Input:
     * - なし
     *
     * Output:
     * - なし
     */
    const handleSaveDraftAndClose = async () => {
      setIsSavingDraft(true)
      try {
        const posts = segmentsToDraftPosts(segments)
        const res = loadedDraft
          ? await updateDraft({ id: loadedDraft.id, posts })
          : await createDraft({ posts })

        if (res.status !== 200) {
          setStatus("下書きの保存に失敗しました。")
          setStatusColor("#b00")
          return
        }

        setDraftSaveConfirmOpen(false)
        onClose?.()
      } catch (error) {
        console.error("ThreadComposer: failed to save draft", error)
        setStatus("下書きの保存に失敗しました。")
        setStatusColor("#b00")
      } finally {
        setIsSavingDraft(false)
      }
    }

    /**
     * 下書きを保存せずフォームを閉じる。
     */
    const handleDiscardDraftAndClose = () => {
      setDraftSaveConfirmOpen(false)
      onClose?.()
    }

    /**
     * フォームを閉じる要求を処理する（キャンセルボタン・Overlay 背景クリック共通）。
     */
    const requestClose = () => {
      if (hasUnsavedDraftChanges()) {
        setDraftSaveConfirmOpen(true)
        return
      }
      onClose?.()
    }

    useImperativeHandle(ref, () => ({ requestClose }))

    /**
     * 「スレッドに追加」導線。末尾に空のセグメントを追加し、それを編集対象にする。
     *
     * Input:
     * - なし
     *
     * Output:
     * - なし
     */
    const handleAddSegment = () => {
      if (segments.length >= MAX_THREAD_POST_COUNT) return
      const nextIndex = segments.length
      setSegments(prev => addSegment(prev, languageCode))
      setActiveIndex(nextIndex)
    }

    /**
     * セグメントを1件削除する（先頭は削除不可、`segments.ts`のremoveSegmentが防御する）。
     *
     * Input:
     * - `index`: 削除対象のindex
     *
     * Output:
     * - なし
     */
    const handleRemoveSegment = (index: number) => {
      if (!canRemoveSegment(index)) return
      setSegments(prev => removeSegment(prev, index))
      setActiveIndex(prevActive => {
        if (index < prevActive) return prevActive - 1
        if (index === prevActive) return Math.max(0, index - 1)
        return prevActive
      })
    }

    /**
     * 投稿フォームの内容を API 契約に合わせて送信する。
     *
     * Input:
     * - `e`: フォーム送信イベント
     *
     * Output:
     * - なし
     */
    const handleSubmit = async (e: React.SubmitEvent<HTMLFormElement>) => {
      e.preventDefault()
      if (isSubmitting) return

      // 投稿API呼び出し（下のawait）を挟んでからwindow.openすると、iOS Safariでは
      // ユーザーアクティベーションが失効気味になり、実際にはポップアップが開いて
      // いるのに戻り値だけ`false`扱いになりフォールバック（ボタン表示）が誤って
      // 走ることがある。そのため自動ポップアップが行われる設定の場合は、ここ
      // （ユーザー操作と同期的なコールスタック内）で先に空のポップアップを開いて
      // おき、URL確定後にrunShareDispatch内でそこへ遷移させる。
      const willAutoPopup =
        !shareToggles.noAutoPopupAfterPost &&
        (shareToggles.crosspostToTaittsuu ||
          shareToggles.crosspostToMastodon ||
          shareToggles.popupIntentInsteadOfWebshare)
      const popupWindow = willAutoPopup ? preOpenPopupWindow() : null

      setIsSubmitting(true)
      setStatus(guestMode ? "処理中…" : "送信中…")
      setStatusColor(undefined)

      try {
        // ゲスト表示ではBluesky認証セッションが無いため、実際の投稿(submitThread)は
        // 行わずスキップする。ただしポップアップ/WebShareAPI等の後続処理は通常時と
        // 同じフローで実行し、見た目を体験できるようにする。
        let skyshareUri = ""
        // 「投稿後にデフォルト値を更新する」がONなら今回使った（先頭セグメントの）設定を
        // 維持し、OFFなら保存済みのデフォルト値へ都度リセットする。投稿成功後、下の
        // textToKeep/resetInputFields分岐でまとめて`segments`へ反映する（`segments`への
        // 更新を複数回に分けてsetSegmentsすると、後発の呼び出しが先発の変更を
        // 古いクロージャの値で上書きしてしまうため、ここでは値の算出のみに留める）。
        let nextRootPostGate = rootSegment.postGate

        if (!guestMode) {
          const result = await submitThread({
            segments,
            manualImageAttach: shareToggles.manualImageAttach,
          })

          if (!result.ok) {
            popupWindow?.close()
            setStatusColor("#b00")
            setStatus(result.message)
            return
          }

          skyshareUri = result.skyshareUri

          if (syncGateDefaultAfterPost) {
            writePostGateDefaultSetting(rootSegment.postGate)
          } else {
            nextRootPostGate = readPostGateDefaultSetting()
          }

          if (loadedDraft) {
            void deleteDraftSilently(loadedDraft.id)
            setLoadedDraft(null)
          }
        }

        segments.forEach(segment =>
          recordUsedHashtagsToHistory(segment.text, accountDid),
        )

        const dispatch = await runShareDispatch({
          text: rootSegment.text,
          skyshareUri,
          linkCardUrl: rootSegment.ogpResult?.sourceUrl ?? "",
          imageEntry: rootSegment.imageEntry,
          manualImageAttach: shareToggles.manualImageAttach,
          crosspostToTaittsuu: shareToggles.crosspostToTaittsuu,
          crosspostToMastodon: shareToggles.crosspostToMastodon,
          mastodonInstanceDomain: shareToggles.mastodonInstanceDomain,
          popupIntentInsteadOfWebshare:
            shareToggles.popupIntentInsteadOfWebshare,
          noAutoPopupAfterPost: shareToggles.noAutoPopupAfterPost,
          popupWindow,
          guestMode,
        })

        onPosted?.()

        if (dispatch.forcedShowXIntentButtonOn) {
          // onShowXWhenCrosspostChange は内部で popupIntentInsteadOfWebshare / noAutoPopupAfterPost の
          // 強制ONも行うため、onNoAutoPopupAfterPostChange は別途呼ぶ必要がない。
          shareToggles.onShowXWhenCrosspostChange(true)
        } else if (dispatch.forcedNoAutoPopupOn) {
          shareToggles.onNoAutoPopupAfterPostChange(true)
        } else if (dispatch.forcedPopupIntentInsteadOfWebshareOn) {
          shareToggles.onPopupIntentInsteadOfWebshareChange(true)
        }
        if (dispatch.textToKeep !== null) {
          // 2件目以降は投稿済みのため破棄し、先頭セグメントのテキストのみ保持する。
          segments
            .slice(1)
            .forEach(segment => revokeImageEntry(segment.imageEntry))
          setSegments([
            {
              ...rootSegment,
              text: dispatch.textToKeep,
              postGate: nextRootPostGate,
            },
          ])
          setActiveIndex(0)
        } else {
          resetInputFields(nextRootPostGate)
        }
        setStatus(dispatch.status)
        setStatusColor(dispatch.statusColor)
      } catch (err) {
        popupWindow?.close()
        console.error(err)
        setStatusColor("#b00")
        setStatus("サーバへ接続できませんでした。")
      } finally {
        setIsSubmitting(false)
      }
    }

    return (
      <>
        {draftListLoading && (
          <Loading overlay message="下書きを読み込み中..." />
        )}

        <Overlay
          open={draftModalOpen}
          onClose={() => setDraftModalOpen(false)}
          contentClassName={`${ui["width-lg"]} ${styles["draft-list-overlay"]}`}
        >
          <div
            className={`${ui["base-card"]} ${ui["dialog-card"]} ${ui["base-padding"]}`}
            role="dialog"
            aria-label="下書き一覧"
            style={{ maxHeight: "80vh", overflow: "hidden" }}
          >
            <div
              className={`${ui["base-component"]} ${ui["toolbar"]} ${ui["toolbar-align"]} ${ui["toolbar-align-center"]}`}
            >
              <button
                type="button"
                className={`${ui["base-button"]} ${ui["text-button"]} ${ui["white-button"]} ${ui["toolbar-item-left"]}`}
                onClick={() => setDraftModalOpen(false)}
              >
                閉じる
              </button>
              <div>下書き一覧</div>
            </div>

            <div className={styles["draft-list-body"]}>
              <DraftListPanel
                items={draftItems}
                loading={draftListLoading}
                error={draftListError ?? undefined}
                onSelectDraft={draft => {
                  setDraftModalOpen(false)
                  applyDraftToForm(draft)
                  setDraftItems(prev =>
                    prev.filter(item => item.id !== draft.id),
                  )
                }}
              />
            </div>
          </div>
        </Overlay>

        <DraftSaveConfirmDialog
          open={draftSaveConfirmOpen}
          isSaving={isSavingDraft}
          onSave={handleSaveDraftAndClose}
          onDiscard={handleDiscardDraftAndClose}
          onContinueEditing={() => setDraftSaveConfirmOpen(false)}
        />

        <div
          ref={formRef}
          className={`${ui["base-card"]} ${ui["dialog-card"]} ${ui["base-padding"]}`}
          {...(variant === "dialog"
            ? { role: "dialog", "aria-label": "投稿フォーム" }
            : {})}
        >
          {isSubmitting && <Loading overlay message="投稿中..." />}
          <div
            className={`${ui["base-component"]} ${ui["toolbar"]} ${ui["toolbar-align"]} ${ui["toolbar-align-between"]}`}
          >
            <div className={`${ui["base-component"]}`}>
              {variant === "dialog" && (
                <button
                  className={`${ui["base-button"]} ${ui["text-button"]} ${ui["white-button"]}`}
                  aria-label="キャンセル"
                  disabled={isSubmitting}
                  onClick={requestClose}
                >
                  キャンセル
                </button>
              )}
            </div>
            <div className={`${ui["base-component"]}`}>
              <button
                type="button"
                className={`${ui["base-button"]} ${ui["text-button"]} ${ui["white-button"]}`}
                disabled={isSubmitting || guestMode}
                title={guestMode ? "ゲスト表示のため利用できません" : undefined}
                onClick={() => {
                  void openDraftPicker()
                }}
              >
                下書き
              </button>
              <button
                type="button"
                className={`${ui["base-button"]} ${ui["text-button"]} ${ui["white-button"]}`}
                disabled={
                  isSubmitting || segments.length >= MAX_THREAD_POST_COUNT
                }
                onClick={handleAddSegment}
              >
                スレッドに追加
              </button>
              <button
                form={entryFormId}
                className={`${ui["base-button"]} ${ui["text-button"]} ${ui["blue-button"]}`}
                type="submit"
                disabled={isSubmitting}
                title={
                  guestMode
                    ? "ゲスト表示のためBlueskyへの投稿はスキップされます"
                    : undefined
                }
              >
                {isThread ? "すべて投稿" : "投稿"}
              </button>

              {showXIntentButton && (
                <button
                  type="button"
                  className={`${ui["base-button"]} ${ui["text-button"]} ${ui["black-button"]}`}
                  disabled={isSubmitting}
                  onClick={() => {
                    const intentText = buildIntentText(
                      rootSegment.text,
                      "",
                      rootSegment.ogpResult?.sourceUrl,
                    )
                    if (!intentText) {
                      setStatus("共有する投稿本文を入力してください。")
                      setStatusColor("#b00")
                      return
                    }

                    const popupOpened = openIntentPopupFor("x", intentText)
                    setStatus(
                      popupOpened
                        ? "x.com 投稿画面を開きました。"
                        : "x.com 投稿画面を開けませんでした。ポップアップブロックを確認してください。",
                    )
                    setStatusColor(popupOpened ? "green" : "#b00")
                  }}
                >
                  X投稿
                </button>
              )}
              {showTaittsuuIntentButton && (
                <button
                  type="button"
                  className={`${ui["base-button"]} ${ui["text-button"]} ${ui["taittsuu-button"]}`}
                  disabled={isSubmitting}
                  onClick={() => {
                    const intentText = buildIntentText(
                      rootSegment.text,
                      "",
                      rootSegment.ogpResult?.sourceUrl,
                    )
                    if (!intentText) {
                      setStatus("共有する投稿本文を入力してください。")
                      setStatusColor("#b00")
                      return
                    }

                    const popupOpened = openIntentPopupFor(
                      "taittsuu",
                      intentText,
                    )
                    setStatus(
                      popupOpened
                        ? "タイッツー投稿画面を開きました。"
                        : "タイッツー投稿画面を開けませんでした。ポップアップブロックを確認してください。",
                    )
                    setStatusColor(popupOpened ? "green" : "#b00")
                  }}
                >
                  <InlineIcon name="taittsuu" />
                  投稿
                </button>
              )}
              {showMastodonIntentButton && (
                <button
                  type="button"
                  className={`${ui["base-button"]} ${ui["text-button"]} ${ui["mastodon-button"]}`}
                  disabled={isSubmitting}
                  onClick={() => {
                    const intentText = buildIntentText(
                      rootSegment.text,
                      "",
                      rootSegment.ogpResult?.sourceUrl,
                    )
                    if (!intentText) {
                      setStatus("共有する投稿本文を入力してください。")
                      setStatusColor("#b00")
                      return
                    }

                    const popupOpened = openIntentPopupFor(
                      "mastodon",
                      intentText,
                      { instanceDomain: shareToggles.mastodonInstanceDomain },
                    )
                    setStatus(
                      popupOpened
                        ? "Mastodon投稿画面を開きました。"
                        : "Mastodon投稿画面を開けませんでした。ポップアップブロックを確認してください。",
                    )
                    setStatusColor(popupOpened ? "green" : "#b00")
                  }}
                >
                  <InlineIcon name="mastodon" />
                  投稿
                </button>
              )}
            </div>
          </div>

          <form
            id={entryFormId}
            ref={entryFormRef}
            className={ui["dialog-body"]}
            onSubmit={handleSubmit}
          >
            {segments.map((segment, index) => (
              <ThreadSegmentForm
                key={segment.id}
                index={index}
                segment={segment}
                isActive={index === activeIndex}
                hasNext={index < segments.length - 1}
                canRemove={canRemoveSegment(index)}
                avatarUrl={avatarUrl}
                accountDid={accountDid}
                disabled={isSubmitting}
                variant={variant}
                formRef={formRef}
                hashtagSuggestEnabled={hashtagSuggestEnabled}
                mentionSuggestEnabled={mentionSuggestEnabled}
                onActivate={() => setActiveIndex(index)}
                onRemove={() => handleRemoveSegment(index)}
                onChange={next => {
                  setSegments(prev =>
                    prev.map((s, i) => (i === index ? next : s)),
                  )
                  if (index === 0) setLanguageCode(next.languageCode)
                }}
                onRequestSubmit={() => entryFormRef.current?.requestSubmit()}
              />
            ))}

            <div className={`${ui["base-padding"]} ${ui["toggle-box"]}`}>
              <ToggleSwitch
                checked={shareToggles.popupIntentInsteadOfWebshare}
                disabled={isSubmitting}
                label={
                  <>
                    <InlineIcon name="share" />
                    の代わりにポップアップ
                    <InlineIcon name="popup" />
                    を開く
                  </>
                }
                onCheckedChange={
                  shareToggles.onPopupIntentInsteadOfWebshareChange
                }
              />
              <ToggleSwitch
                checked={shareToggles.manualImageAttach}
                disabled={isSubmitting}
                label="画像を自分で添付する（URLを発行しない）"
                onCheckedChange={shareToggles.onManualImageAttachChange}
              />
              <ToggleSwitch
                checked={syncGateDefaultAfterPost}
                disabled={isSubmitting}
                label="返信・引用オプションを保存する"
                onCheckedChange={next => {
                  setSyncGateDefaultAfterPost(next)
                  writeSyncGateDefaultAfterPostSetting(next)
                }}
              />
            </div>

            <div className={ui["base-component"]}>
              <Collapsible
                key={shareTogglesReady ? "loaded" : "loading"}
                label="詳細オプション"
                defaultOpen={defaultOpenShareOptions}
              >
                <div className={ui["toggle-box"]}>
                  <ToggleSwitch
                    checked={pinnedFormDisabled}
                    disabled={isSubmitting}
                    label="投稿フォームを固定表示しない"
                    onCheckedChange={next => {
                      setPinnedFormDisabled(next)
                      writePinnedFormDisabledSetting(next)
                      onPinnedFormDisabledChange?.(next)
                    }}
                  />
                  <ToggleSwitch
                    checked={shareToggles.showXWhenCrosspost}
                    disabled={isSubmitting}
                    label="X投稿ボタンを表示"
                    onCheckedChange={shareToggles.onShowXWhenCrosspostChange}
                  />
                  <ToggleSwitch
                    checked={shareToggles.noAutoPopupAfterPost}
                    disabled={isSubmitting}
                    label="自動ポップアップをOFFにする"
                    onCheckedChange={shareToggles.onNoAutoPopupAfterPostChange}
                  />
                  <ToggleSwitch
                    checked={shareToggles.crosspostToTaittsuu}
                    disabled={isSubmitting}
                    label={
                      <>
                        <InlineIcon name="taittsuu" />
                        にクロスポスト
                      </>
                    }
                    onCheckedChange={shareToggles.onCrosspostToTaittsuuChange}
                  />
                  <ToggleSwitch
                    checked={shareToggles.crosspostToMastodon}
                    disabled={isSubmitting}
                    label={
                      <>
                        <InlineIcon name="mastodon" />
                        にクロスポスト
                      </>
                    }
                    onCheckedChange={shareToggles.onCrosspostToMastodonChange}
                  />
                </div>
              </Collapsible>
            </div>
            {status !== "" && status !== null && (
              <div
                id="status"
                aria-live="polite"
                className={`${ui["base-component"]} ${ui["toolbar"]}`}
                style={{ color: statusColor }}
              >
                {status}
              </div>
            )}
          </form>
        </div>
      </>
    )
  },
)

export default Component
