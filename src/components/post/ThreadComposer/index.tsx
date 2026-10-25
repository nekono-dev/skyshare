/**
 * 投稿フォーム（スレッド投稿対応）コンポーネント。
 *
 * 責務と処理概要:
 * - スレッド投稿のセグメント配列（`segments`）と現在編集中のセグメント（`activeIndex`）を
 *   管理する。単発投稿はセグメント数1件のケースとして同一のコンポーネントが扱う
 *   （`specs/thread-composer`。以前の単発投稿専用`PostForm`はこの
 *   コンポーネントへ一般化され、独立した存在ではなくなった）。
 * - 各セグメントの入力補助UI（本文欄・画像・OGP・返信/引用設定・自己ラベル・言語選択）は
 *   `ThreadSegmentForm`に委譲し、本体はセグメント配列の管理・共有系トグルの永続化・
 *   下書き一覧・投稿成功後のポップアップ/WebShareAPI分岐の呼び出しに専念する。
 * - クロスポスト（自動ポップアップ・WebShareAPI）は先頭（1件目）セグメントのみを
 *   対象とする（2件目以降は対象外）。仕様書に明記が無かったため実装時に決定した方針。
 * - API送信は`submitThread`、投稿成功後のポップアップ/WebShareAPI分岐は`shareDispatch`に
 *   それぞれ委譲する。
 * - 予約投稿: 予約の状態（`scheduleMode`）を保持し、実行日時が設定されていれば送信ボタンを
 *   「予約」「すべて予約」に変え、予約の作成・置き換えを `submitSchedule` に委ねる。
 *   状態の遷移・送信先・キャンセルの動作の判定は `lib/schedule/scheduleMode` が決める。
 * - 下書き・予約: 下書きの一覧と予約の一覧をタブで切り替える画面を開き、選んだ下書きか
 *   予約の内容をセグメントへ戻す。
 * - 予約投稿が無効のときにカレンダーのボタンを押すと、設定で有効にする案内を出し、
 *   「設定を開く」で設定のページへ移る。
 * - 作成中（未保存の本文がある）にリンクで他のページへ移ろうとしたときは、移動を止めて
 *   下書き保存の確認（保存して移る・破棄して移る・編集を続ける）を出す。
 */
import { useLocale, useT } from "@/lib/i18n/react"
import { renderSlots } from "@/lib/i18n/rich"
import {
  deferMessage,
  type DeferredMessage,
  type PlainMessageKey,
} from "@/lib/i18n/translate"
import { navigate } from "astro:transitions/client"
import { navigatingLinkTarget } from "@/util/links"
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
import { detectLinkFacets, extractTagsFromFacets } from "@/lib/atproto/richtext"
import { resolveShareBody } from "@/lib/share/shareBody"
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
  resolveMastodonInstanceDomain,
  writePinnedFormDisabledSetting,
} from "@/lib/settings/shareSettings"
import { readTimelineHiddenSetting } from "@/lib/settings/timelineSettings"
import {
  readHashtagSuggestEnabledSetting,
  readMentionSuggestEnabledSetting,
} from "@/lib/settings/suggestSettings"
import IntentShareDialog, {
  type IntentShareRequest,
} from "@/components/post/IntentShareDialog"
import AutoPopupTargetSelect from "@/components/common/AutoPopupTargetSelect"
import { preOpenPopupWindow } from "@/util/share/openIntentPopup"
import { runShareDispatch } from "./shareDispatch"
import ChoiceDialog from "@/components/common/ChoiceDialog"
import TabButtons, { panelId, tabId } from "@/components/common/TabButtons"
import RunAtPicker from "@/components/schedule/RunAtPicker"
import CredentialDialog from "@/components/schedule/CredentialDialog"
import ScheduleList from "@/components/schedule/ScheduleList"
import type { CreateScheduleBody } from "@/client/openapi/model"
import { formatRunAtLabel } from "@/lib/schedule/runAtInput"
import {
  applyRunAtChange,
  cancelAction,
  editScheduleMode,
  initialScheduleMode,
  runAtOf,
  submitLabelKey,
  submitTarget,
  type ScheduleMode,
} from "@/lib/schedule/scheduleMode"
import {
  cancelSchedule,
  fetchPendingCount,
  fetchScheduleForEdit,
  submitSchedule,
} from "@/lib/schedule/submitSchedule"
import { useScheduleAvailability } from "@/lib/schedule/useScheduleAvailability"
import { buildThreadRequestBody, submitThread } from "./submitThread"
import { useShareToggles } from "@/lib/settings/useShareToggles"
import { estimateSkyshareEntryUrl } from "@/lib/entry/estimateEntryUrl"
import { resolveCounterTargets } from "@/lib/share/counterReserve"
import ThreadSegmentForm from "./ThreadSegmentForm"
import {
  addSegment,
  areAllSegmentsPostable,
  canRemoveSegment,
  createEmptySegment,
  draftPostsToSegments,
  hasVideoSegment,
  pendingVideoState,
  removeSegment,
  revokeImageEntry,
  scheduleDetailToSegments,
  revokeVideoEntry,
  segmentsToDraftPosts,
  type SegmentState,
} from "./segments"
import styles from "./index.module.css"
import ui from "@/styles/ui.module.css"

type Props = {
  /**
   * "dialog": PostLauncher の Overlay に埋め込まれるモーダル表示（既定値）。
   * "page": ページに常時表示する単独フォーム（post.astro 等）。dialog専用の
   * role="dialog"/aria-labelを省く。キャンセルボタンは同位置に置くが、
   * 閉じる代わりに入力内容をクリアする。
   */
  variant?: "dialog" | "page"
  onClose?: () => void
  onPosted?: () => void
  /**
   * 投稿先選択ダイアログの表示要求を親へ委譲する。
   * PostLauncher のように投稿成功でこのフォームごと（Overlayごと）アンマウントされる
   * 親では、ダイアログも一緒に消えてしまうため、親側で描画できるようにする用途。
   * 未指定の場合はこのコンポーネント自身がダイアログを描画する。
   */
  onShareRequest?: (request: IntentShareRequest) => void
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
   * その後の自動ポップアップ・WebShareAPI・投稿先選択ダイアログ等の
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
      onShareRequest,
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
    const translator = useT()
    const { t, raw } = translator
    const entryFormId = useId()
    const [languageCode, setLanguageCode] = useState("ja")
    const [segments, setSegments] = useState<SegmentState[]>(() => [
      createEmptySegment("ja"),
    ])
    const [activeIndex, setActiveIndex] = useState(0)
    const shareToggles = useShareToggles()
    // 文字数カウンタ: 表示する共有先と、entryが作られる場合の予測URL（共有文末尾の上限補正用）。
    // entryは「画像/動画を含み、かつ画像を自分で添付しない」場合のみ作られる（submitThreadと同条件）。
    const counterTargets = resolveCounterTargets(
      shareToggles.autoPopupTarget,
      shareToggles.popupIntentInsteadOfWebshare,
    )
    const willCreateEntry =
      !shareToggles.manualImageAttach &&
      segments.some(segment => !!segment.imageEntry || !!segment.videoEntry)
    const estimatedEntryUrl = willCreateEntry
      ? estimateSkyshareEntryUrl(accountDid)
      : null
    // SSRは常にfalseでレンダリングするため、初期stateもfalse固定にし、実際の設定値は
    // マウント後のuseEffectで反映する（hydration mismatch対策）。
    const [pinnedFormDisabled, setPinnedFormDisabled] = useState(false)
    // 「タイムラインを表示しない」がONの間は投稿フォームが常に固定表示されるため、
    // 「投稿フォームを固定表示しない」はOFF表示かつ操作不能にする（保存値は保持する）。
    const [timelineHidden, setTimelineHidden] = useState(false)
    useEffect(() => {
      setPinnedFormDisabled(readPinnedFormDisabledSetting(false))
      setTimelineHidden(readTimelineHiddenSetting(false))
    }, [])
    const effectivePinnedFormDisabled = pinnedFormDisabled && !timelineHidden
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
    // ステータス文言は組み立て関数で保持し、描画時に現在の表示言語で評価する
    // （表示後に言語を切り替えても追従させるため）。
    const [status, setStatus] = useState<DeferredMessage | null>(null)
    // 投稿先選択ダイアログの共有対象。`onShareRequest` 未指定時のみこのstateで描画する。
    const [shareRequest, setShareRequest] = useState<IntentShareRequest | null>(
      null,
    )
    const [statusColor, setStatusColor] = useState<string | undefined>(
      undefined,
    )
    const [isSubmitting, setIsSubmitting] = useState(false)
    // 予約の状態（日時なし・新規の予約・予約の編集中・編集中に取り消した後）
    const [scheduleMode, setScheduleMode] =
      useState<ScheduleMode>(initialScheduleMode)
    const [runAtPickerOpen, setRunAtPickerOpen] = useState(false)
    // 日時の指定を開くたびに取得する、待機中の予約の件数（取得前・失敗は null）
    const [pendingCount, setPendingCount] = useState<number | null>(null)
    useEffect(() => {
      if (!runAtPickerOpen) return
      let cancelled = false
      setPendingCount(null)
      void fetchPendingCount().then(count => {
        if (!cancelled) setPendingCount(count)
      })
      return () => {
        cancelled = true
      }
    }, [runAtPickerOpen])
    const [editChoiceOpen, setEditChoiceOpen] = useState(false)
    const [editChoiceBusy, setEditChoiceBusy] = useState(false)
    const [scheduleLoading, setScheduleLoading] = useState(false)
    // 失敗した予約から書き戻した入力のとき、その履歴の識別子。送信に成功したら履歴を削除する
    const [restoredFailedId, setRestoredFailedId] = useState<string | null>(
      null,
    )
    // 下書き・予約の画面のタブ。開くたびに下書きのタブへ戻す
    const [draftTab, setDraftTab] = useState<"drafts" | "schedules">("drafts")
    // 送信中の2回目の確定操作を、state の反映を待たずに無視するための印
    const submittingRef = useRef(false)
    const locale = useLocale()
    const {
      registered: scheduleRegistered,
      reauthRequired: scheduleReauthRequired,
      expiresAt: scheduleExpiresAt,
      limits: scheduleLimits,
    } = useScheduleAvailability(!guestMode)
    const [draftModalOpen, setDraftModalOpen] = useState(false)
    const [draftItems, setDraftItems] = useState<
      ReturnType<typeof normalizeDraftList>
    >([])
    const [draftListLoading, setDraftListLoading] = useState(false)
    const [draftListError, setDraftListError] =
      useState<PlainMessageKey | null>(null)
    const [loadedDraft, setLoadedDraft] = useState<LoadedDraft | null>(null)
    const [draftSaveConfirmOpen, setDraftSaveConfirmOpen] = useState(false)
    // 予約投稿が無効のときにカレンダーのボタンを押した際の、設定への案内
    const [setupGuideOpen, setSetupGuideOpen] = useState(false)
    // 許可が無効になったときにカレンダーのボタンを押した際の、再度の許可のダイアログ
    const [reauthOpen, setReauthOpen] = useState(false)
    // 下書き保存の確認の後に移るページ。null のときは、確認の後にフォームを閉じるだけ
    const [pendingNavigation, setPendingNavigation] = useState<string | null>(
      null,
    )
    const [isSavingDraft, setIsSavingDraft] = useState(false)
    const formRef = useRef<HTMLDivElement>(null)
    const entryFormRef = useRef<HTMLFormElement>(null)

    const rootSegment = segments[0]
    const hasTextInput = segments.some(s => s.text.trim().length > 0)
    const isThread = segments.length > 1

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
      segments.forEach(segment => {
        revokeImageEntry(segment.imageEntry)
        revokeVideoEntry(segment.videoEntry)
      })
      setSegments([
        { ...createEmptySegment(languageCode), postGate: rootPostGate },
      ])
      setActiveIndex(0)
      setLoadedDraft(null)
      setScheduleMode(initialScheduleMode)
      setRestoredFailedId(null)
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
      setDraftTab("drafts")
      setDraftModalOpen(true)
      setDraftListLoading(true)
      setDraftListError(null)

      try {
        const res = await getDrafts({ limit: 100 })
        if (res.status !== 200) {
          setDraftItems([])
          setDraftListError("post.composer.draftListLoadFailed")
          return
        }

        setDraftItems(normalizeDraftList(res.data.drafts))
      } catch (error) {
        console.error("ThreadComposer: failed to load drafts", error)
        setDraftItems([])
        setDraftListError("post.composer.draftListLoadFailed")
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
      segments.forEach(segment => {
        revokeImageEntry(segment.imageEntry)
        revokeVideoEntry(segment.videoEntry)
      })
      const restored = draftPostsToSegments(draft.posts, languageCode)
      const nextSegments =
        restored.length > 0 ? restored : [createEmptySegment(languageCode)]
      setSegments(nextSegments)
      setActiveIndex(0)
      setLoadedDraft({
        id: draft.id,
        posts: segmentsToDraftPosts(nextSegments),
      })
      // 下書きは予約と結び付かないため、予約の状態を通常の入力へ戻す（予約そのものは残る）
      setScheduleMode(initialScheduleMode)
      setRestoredFailedId(null)
      setStatus(deferMessage("post.composer.draftApplied"))
      setStatusColor("green")
    }

    /**
     * 失敗した予約から書き戻した入力の送信に成功したとき、元の失敗の履歴をバックグラウンドで削除する。
     * 失敗しても利用者の操作は妨げない（履歴は保持期間の後片付けで消える）。
     */
    const deleteRestoredFailedSilently = () => {
      if (!restoredFailedId) return
      void cancelSchedule(restoredFailedId)
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
     * フォームを閉じる。dialog では `onClose` に委ね、常時表示の page では
     * 閉じられないため入力内容（返信/引用設定は維持）をクリアする。
     */
    const closeForm = () => {
      if (variant === "dialog") {
        onClose?.()
        return
      }
      resetInputFields(segments[0].postGate)
    }

    /**
     * 他のページへ移る。同じオリジンならページ遷移（`navigate`）、別のオリジンなら通常の遷移にする。
     */
    const goTo = (to: string) => {
      const url = new URL(to, window.location.href)
      if (url.origin === window.location.origin) void navigate(url.href)
      else window.location.assign(url.href)
    }

    /**
     * 下書き保存の確認を済ませた後の動作。フォームを閉じ、移る先が決まっていればそのページへ移る。
     */
    const finishAfterDraftConfirm = () => {
      setDraftSaveConfirmOpen(false)
      closeForm()
      goToPendingNavigation()
    }

    /**
     * 他のページへ移る。閉じるときと同じ確認（予約の編集中は3択、未保存の本文があれば
     * 下書き保存の確認）を挟んでから移り、作成中の内容を不意に失わないようにする。
     *
     * Input:
     * - `to`: 移る先の URL またはパス（再度の許可では Bluesky の認可の画面）
     */
    const requestNavigation = (to: string) => {
      const action = cancelAction(
        scheduleMode,
        hasUnsavedDraftChanges(),
        hasTextInput,
      )
      if (action === "close") {
        goTo(to)
        return
      }
      setPendingNavigation(to)
      if (action === "editChoice") setEditChoiceOpen(true)
      else setDraftSaveConfirmOpen(true)
    }

    /** 確認の後に移る先が決まっていれば、そのページへ移る */
    const goToPendingNavigation = () => {
      if (!pendingNavigation) return
      const to = pendingNavigation
      setPendingNavigation(null)
      goTo(to)
    }

    // 作成中にリンクを押して別のページへ移ろうとしたら、移動を止めて下書き保存の確認を出す。
    // Astro のページ遷移の通知（astro:before-preparation）は、取り消すと全体の再読み込みに
    // 切り替わり、入力が失われるため使わず、遷移を始める前のクリックを捕まえる。
    // ブラウザの戻る・進む、再読み込み、タブを閉じる操作は対象にしない。
    // クリックの購読はマウント中ずっと同じ関数で行うため、最新の状態は ref 経由で参照する。
    const requestNavigationRef = useRef(requestNavigation)
    requestNavigationRef.current = requestNavigation
    const hasUnsavedRef = useRef(hasUnsavedDraftChanges)
    hasUnsavedRef.current = hasUnsavedDraftChanges
    useEffect(() => {
      const onClick = (event: MouseEvent) => {
        const to = navigatingLinkTarget(event, window.location)
        if (!to || !hasUnsavedRef.current()) return
        // Astro のリンクの処理（バブリング段階）へ届く前に止める
        event.preventDefault()
        event.stopPropagation()
        requestNavigationRef.current(to.href)
      }
      document.addEventListener("click", onClick, true)
      return () => document.removeEventListener("click", onClick, true)
    }, [])

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
          setStatus(deferMessage("post.composer.draftSaveFailed"))
          setStatusColor("#b00")
          return
        }

        finishAfterDraftConfirm()
      } catch (error) {
        console.error("ThreadComposer: failed to save draft", error)
        setStatus(deferMessage("post.composer.draftSaveFailed"))
        setStatusColor("#b00")
      } finally {
        setIsSavingDraft(false)
      }
    }

    /**
     * 下書きを保存せずフォームを閉じる。
     */
    const handleDiscardDraftAndClose = () => {
      finishAfterDraftConfirm()
    }

    /**
     * フォームを閉じる要求を処理する（キャンセルボタン・Overlay 背景クリック共通）。
     *
     * 処理の趣旨:
     * - 予約の編集中は、予約の取消・予約を残して閉じる・編集を続けるの3択を出す。
     * - 編集中に日時を解除して予約を取り消した後は、変更がなくても下書きの保存を確認する。
     * - それ以外（新規の予約を含む）は、下書きの保存の確認に従う。
     */
    const requestClose = () => {
      const action = cancelAction(
        scheduleMode,
        hasUnsavedDraftChanges(),
        hasTextInput,
      )
      if (action === "editChoice") {
        setEditChoiceOpen(true)
        return
      }
      if (action === "draftConfirm") {
        setDraftSaveConfirmOpen(true)
        return
      }
      closeForm()
    }

    /**
     * 予約の編集中のキャンセルで「予約を取り消す」を選んだとき。
     * 取消に成功したらフォームを閉じ、失敗したら3択を閉じて文言を表示する（入力は残す）。
     */
    const handleCancelScheduleAndClose = async () => {
      if (scheduleMode.kind !== "editing") return
      setEditChoiceBusy(true)
      try {
        const result = await cancelSchedule(scheduleMode.id)
        setEditChoiceOpen(false)
        if (!result.ok) {
          setPendingNavigation(null)
          setStatus(deferMessage(result.messageKey))
          setStatusColor("#b00")
          return
        }
        closeForm()
        setStatus(deferMessage("schedule.cancelled"))
        setStatusColor("green")
        goToPendingNavigation()
      } finally {
        setEditChoiceBusy(false)
      }
    }

    /**
     * 実行日時の設定・解除を反映する。
     *
     * 処理の趣旨:
     * - 予約の編集中に解除したら、確認なしで予約を取り消す。フォームの内容は残す。
     * - 取消に失敗したら、編集中の状態と日時に戻して文言を表示する。
     *
     * Input:
     * - `next`: 設定した日時、または解除（null）
     */
    const handleRunAtChange = async (next: Date | null) => {
      const previous = scheduleMode
      const { mode, cancelScheduleId } = applyRunAtChange(previous, next)
      setScheduleMode(mode)
      if (!cancelScheduleId) return
      const result = await cancelSchedule(cancelScheduleId)
      if (!result.ok) {
        setScheduleMode(previous)
        setStatus(deferMessage(result.messageKey))
        setStatusColor("#b00")
        return
      }
      setStatus(deferMessage("schedule.cancelled"))
      setStatusColor("green")
    }

    /**
     * 予約のタブで選んだ予約を、内容と画像ごとフォームへ戻す。待機中の予約は編集中にし、
     * 失敗した予約は日時の無い新規の入力として戻す（送信に成功したら元の履歴を削除する）。
     * 取得に失敗したら、フォームを変えずに文言を表示する。
     *
     * Input:
     * - `id`: 予約の識別子
     */
    const applyScheduleToForm = async (id: string) => {
      setDraftModalOpen(false)
      setScheduleLoading(true)
      try {
        const loaded = await fetchScheduleForEdit(id)
        if (!loaded.ok) {
          setStatus(deferMessage(loaded.messageKey))
          setStatusColor("#b00")
          return
        }
        segments.forEach(segment => {
          revokeImageEntry(segment.imageEntry)
          revokeVideoEntry(segment.videoEntry)
        })
        const nextSegments = scheduleDetailToSegments(
          loaded.detail,
          loaded.images,
          languageCode,
        )
        setSegments(nextSegments)
        setActiveIndex(0)
        setLanguageCode(nextSegments[0]!.languageCode)
        setLoadedDraft(null)
        if (loaded.detail.status === "failed") {
          // 失敗した予約は、日時の無い新規の入力として戻す（送信に成功したら元の履歴を削除する）
          setScheduleMode(initialScheduleMode)
          setRestoredFailedId(id)
        } else {
          setScheduleMode(editScheduleMode(id, loaded.runAt))
          setRestoredFailedId(null)
        }
        setStatus(deferMessage("schedule.applied"))
        setStatusColor("green")
      } finally {
        setScheduleLoading(false)
      }
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

    // いずれかのセグメントがバックエンドの投稿条件を満たさない間は投稿ボタンを無効化する
    // 動画のアップロード・変換が完了するまで（失敗した動画が残る間も）投稿できない。
    // 取り外し（キャンセル）した場合のみ、完了を待たずに投稿できる。
    const videoPending = pendingVideoState(segments)
    const canSubmit = areAllSegmentsPostable(segments) && videoPending === null
    // 動画は予約に含められない（動画を含む間はカレンダーのボタンを無効にし、
    // 予約の日時の設定中は動画のボタンを無効にする）
    const hasVideo = hasVideoSegment(segments)
    const scheduleAvailable =
      !guestMode &&
      scheduleRegistered === true &&
      !scheduleReauthRequired &&
      scheduleLimits !== null
    // カレンダーのボタンを押せない理由。押せるときは undefined
    const scheduleUnavailableReason = guestMode
      ? t("post.guestUnavailable")
      : hasVideo
        ? t("schedule.unavailableVideo")
        : scheduleRegistered !== true
          ? t("schedule.unavailableDisabled")
          : scheduleReauthRequired
            ? t("schedule.unavailableReauth")
            : scheduleLimits === null
              ? t("schedule.unavailableLimits")
              : undefined
    const target = submitTarget(scheduleMode)
    const scheduledRunAt = runAtOf(scheduleMode)
    // 予約として送信するときは、動画を含む投稿を送れない
    const canSubmitNow = canSubmit && (target.kind === "post" || !hasVideo)

    /**
     * 予約の作成・置き換えを送信する（実行日時が設定されているときの送信ボタン）。
     *
     * 処理の趣旨:
     * - 本文は投稿の作成と同じ組み立てを使い、他の SNS への共有は行わない。
     * - 成功したら完了を表示し、ハッシュタグの履歴を記録して、フォームを初期化する
     *   （開いていた下書きは予約へ移したものとして削除する）。
     * - 置き換えの時点で予約が実行中になっていたら、取り消された後と同じ扱い（detached）にする。
     *
     * Input:
     * - `scheduleTarget`: 新規の予約か、編集中の予約と実行日時
     */
    const handleScheduleSubmit = async (
      scheduleTarget: Exclude<typeof target, { kind: "post" }>,
    ) => {
      setIsSubmitting(true)
      setStatus(deferMessage("schedule.sending"))
      setStatusColor(undefined)
      try {
        const built = await buildThreadRequestBody({
          segments,
          manualImageAttach: shareToggles.manualImageAttach,
        })
        if (!built.ok) {
          setStatus(deferMessage(built.messageKey))
          setStatusColor("#b00")
          return
        }
        const result = await submitSchedule(
          scheduleTarget,
          built.body as unknown as Omit<CreateScheduleBody, "runAt">,
        )
        if (!result.ok) {
          if (
            scheduleTarget.kind === "update" &&
            result.messageKey === "schedule.error.running"
          ) {
            setScheduleMode({ kind: "detached" })
          }
          setStatus(deferMessage(result.messageKey))
          setStatusColor("#b00")
          return
        }
        segments.forEach(segment =>
          recordUsedHashtagsToHistory(segment.text, accountDid),
        )
        if (loadedDraft) void deleteDraftSilently(loadedDraft.id)
        deleteRestoredFailedSilently()
        let nextRootPostGate = rootSegment.postGate
        if (syncGateDefaultAfterPost) {
          writePostGateDefaultSetting(rootSegment.postGate)
        } else {
          nextRootPostGate = readPostGateDefaultSetting()
        }
        resetInputFields(nextRootPostGate)
        setStatus(
          deferMessage(
            scheduleTarget.kind === "create"
              ? "schedule.created"
              : "schedule.updated",
          ),
        )
        setStatusColor("green")
      } catch (err) {
        console.error(err)
        setStatus(deferMessage("error.network"))
        setStatusColor("#b00")
      } finally {
        setIsSubmitting(false)
      }
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
      // Enterキー等によるフォーム送信でもボタンと同じ投稿条件でブロックする
      if (isSubmitting || submittingRef.current || !canSubmitNow) return

      // 実行日時が設定されていれば予約として送信する（共有のポップアップは開かない）
      if (target.kind !== "post") {
        submittingRef.current = true
        try {
          await handleScheduleSubmit(target)
        } finally {
          submittingRef.current = false
        }
        return
      }

      // 投稿API呼び出し（下のawait）を挟んでからwindow.openすると、iOS Safariでは
      // ユーザーアクティベーションが失効気味になり、実際にはポップアップが開いて
      // いるのに戻り値だけ`false`扱いになりフォールバック（ボタン表示）が誤って
      // 走ることがある。そのため自動ポップアップが行われる設定の場合は、ここ
      // （ユーザー操作と同期的なコールスタック内）で先に空のポップアップを開いて
      // おき、URL確定後にrunShareDispatch内でそこへ遷移させる。
      // 自動ポップアップ先を決められない場合（投稿時に選択する、またはMastodonの
      // ドメインが不正）は、ポップアップを開かず投稿先選択ダイアログに委ねるため開かない。
      const willAutoPopup =
        shareToggles.popupIntentInsteadOfWebshare &&
        shareToggles.autoPopupTarget !== "ask" &&
        !(
          shareToggles.autoPopupTarget === "mastodon" &&
          resolveMastodonInstanceDomain(shareToggles.mastodonInstanceDomain) ===
            null
        )
      const popupWindow = willAutoPopup ? preOpenPopupWindow() : null

      setIsSubmitting(true)
      setStatus(
        deferMessage(
          guestMode ? "post.composer.guestProcessing" : "post.composer.sending",
        ),
      )
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
            setStatus(deferMessage(result.messageKey))
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
          deleteRestoredFailedSilently()
        }

        segments.forEach(segment =>
          recordUsedHashtagsToHistory(segment.text, accountDid),
        )

        // 「Skyshareのリンクカードを優先表示」が有効で skyshare URL を共有する場合は、
        // 本文のURLを共有文から取り除く（自動ポップアップ・WebShare・投稿先選択ダイアログ共通）。
        const shareBody = resolveShareBody({
          text: rootSegment.text,
          facets: skyshareUri === "" ? [] : detectLinkFacets(rootSegment.text),
          entryUrl: skyshareUri,
          linkCardUrl: rootSegment.ogpResult?.sourceUrl ?? "",
          preferSkyshareLinkCard: shareToggles.effectivePreferSkyshareLinkCard,
        })

        const dispatch = await runShareDispatch({
          text: shareBody.text,
          skyshareUri,
          linkCardUrl: shareBody.linkCardUrl,
          imageEntry: rootSegment.imageEntry,
          manualImageAttach: shareToggles.manualImageAttach,
          truncateIntentText: shareToggles.truncateIntentText,
          popupIntentInsteadOfWebshare:
            shareToggles.popupIntentInsteadOfWebshare,
          autoPopupTarget: shareToggles.autoPopupTarget,
          mastodonInstanceDomain: shareToggles.mastodonInstanceDomain,
          popupWindow,
          guestMode,
        })

        onPosted?.()

        if (dispatch.forcedPopupIntentInsteadOfWebshareOn) {
          shareToggles.onPopupIntentInsteadOfWebshareChange(true)
        }
        if (dispatch.forcedAutoPopupTarget !== null) {
          shareToggles.onAutoPopupTargetChange(dispatch.forcedAutoPopupTarget)
        }
        // 投稿先選択ダイアログは入力欄の内容に依存しないよう、本文・URLをここで確定させる。
        // 入力欄は結果に関わらず常にクリアする（skyshare URLはダイアログ側が保持する）。
        if (dispatch.openShareDialog) {
          const request: IntentShareRequest = {
            postText: shareBody.text,
            entryUrl: skyshareUri === "" ? null : skyshareUri,
            linkCardUrl: shareBody.linkCardUrl,
          }
          if (onShareRequest) {
            onShareRequest(request)
          } else {
            setShareRequest(request)
          }
        }
        resetInputFields(nextRootPostGate)
        setStatus({ format: dispatch.status })
        setStatusColor(dispatch.statusColor)
      } catch (err) {
        popupWindow?.close()
        console.error(err)
        setStatusColor("#b00")
        setStatus(deferMessage("error.network"))
      } finally {
        setIsSubmitting(false)
      }
    }

    return (
      <>
        {scheduleLoading && (
          <Loading overlay message={t("schedule.loadingEdit")} />
        )}

        <Overlay
          open={draftModalOpen}
          onClose={() => setDraftModalOpen(false)}
          backdropClassName={styles["draft-list-backdrop"]}
          contentClassName={`${ui["width-lg"]} ${styles["draft-list-overlay"]}`}
        >
          <div
            className={`${ui["base-card"]} ${ui["dialog-card"]} ${ui["base-padding"]}`}
            role="dialog"
            aria-label={t("post.composer.draftListTitle")}
            style={{ maxHeight: "80vh", overflow: "hidden" }}
          >
            <div
              className={`${ui["base-component"]} ${ui["toolbar"]} ${ui["toolbar-align"]} ${ui["toolbar-align-center"]} ${styles["draft-list-header"]}`}
            >
              <button
                type="button"
                className={`${ui["base-button"]} ${ui["text-button"]} ${ui["white-button"]} ${ui["toolbar-item-left"]}`}
                onClick={() => setDraftModalOpen(false)}
              >
                {t("common.close")}
              </button>
              <div>{t("post.composer.draftListTitle")}</div>
            </div>

            <TabButtons
              idPrefix={`${entryFormId}-drafts`}
              ariaLabel={t("post.composer.draftListTitle")}
              items={[
                { key: "drafts", label: t("post.composer.draftsTab") },
                { key: "schedules", label: t("post.composer.schedulesTab") },
              ]}
              value={draftTab}
              onChange={setDraftTab}
            />
            <div
              className={styles["draft-list-body"]}
              role="tabpanel"
              id={panelId(`${entryFormId}-drafts`, "drafts")}
              aria-labelledby={tabId(`${entryFormId}-drafts`, "drafts")}
              hidden={draftTab !== "drafts"}
            >
              <DraftListPanel
                items={draftItems}
                loading={draftListLoading}
                error={draftListError ? t(draftListError) : undefined}
                onSelectDraft={draft => {
                  setDraftModalOpen(false)
                  applyDraftToForm(draft)
                  setDraftItems(prev =>
                    prev.filter(item => item.id !== draft.id),
                  )
                }}
              />
            </div>
            <div
              className={styles["draft-list-body"]}
              role="tabpanel"
              id={panelId(`${entryFormId}-drafts`, "schedules")}
              aria-labelledby={tabId(`${entryFormId}-drafts`, "schedules")}
              hidden={draftTab !== "schedules"}
            >
              <ScheduleList
                active={draftModalOpen && draftTab === "schedules"}
                onSelect={id => void applyScheduleToForm(id)}
                onOpenSettings={
                  scheduleRegistered === false
                    ? () => {
                        setDraftModalOpen(false)
                        requestNavigation("/settings/")
                      }
                    : undefined
                }
              />
            </div>
          </div>
        </Overlay>

        <ChoiceDialog
          open={editChoiceOpen}
          onClose={() => {
            setEditChoiceOpen(false)
            setPendingNavigation(null)
          }}
          ariaLabel={t("schedule.editCancel.title")}
          loading={
            editChoiceBusy ? { message: t("schedule.sending") } : undefined
          }
          buttons={[
            {
              key: "cancelSchedule",
              label: t("schedule.editCancel.cancelSchedule"),
              variant: "red",
              disabled: editChoiceBusy,
              onClick: () => handleCancelScheduleAndClose(),
            },
            {
              key: "keep",
              label: t("schedule.editCancel.keep"),
              variant: "gray",
              disabled: editChoiceBusy,
              onClick: () => {
                setEditChoiceOpen(false)
                closeForm()
                goToPendingNavigation()
              },
            },
            {
              key: "continue",
              label: t("schedule.editCancel.continue"),
              variant: "blue",
              disabled: editChoiceBusy,
              onClick: () => {
                setEditChoiceOpen(false)
                setPendingNavigation(null)
              },
            },
          ]}
        />

        <ChoiceDialog
          open={setupGuideOpen}
          onClose={() => setSetupGuideOpen(false)}
          ariaLabel={t("schedule.setupGuide.title")}
          description={t("schedule.setupGuide.message")}
          buttons={[
            {
              key: "openSettings",
              label: t("schedule.setupGuide.open"),
              variant: "blue",
              onClick: () => {
                setSetupGuideOpen(false)
                requestNavigation("/settings/")
              },
            },
            {
              key: "close",
              label: t("schedule.setupGuide.close"),
              variant: "gray",
              onClick: () => setSetupGuideOpen(false),
            },
          ]}
        />

        <CredentialDialog
          open={reauthOpen}
          onClose={() => setReauthOpen(false)}
          navigate={url => {
            // 認可の画面へ移る前に、作成中の内容の扱いを確かめる
            setReauthOpen(false)
            requestNavigation(url)
          }}
        />

        <DraftSaveConfirmDialog
          open={draftSaveConfirmOpen}
          isSaving={isSavingDraft}
          onSave={handleSaveDraftAndClose}
          onDiscard={handleDiscardDraftAndClose}
          onContinueEditing={() => {
            setDraftSaveConfirmOpen(false)
            setPendingNavigation(null)
          }}
        />

        <div
          ref={formRef}
          className={`${ui["base-card"]} ${ui["dialog-card"]} ${ui["base-padding"]}`}
          {...(variant === "dialog"
            ? { role: "dialog", "aria-label": t("post.composer.formAria") }
            : {})}
        >
          {isSubmitting && (
            <Loading
              overlay
              message={
                target.kind === "post"
                  ? t("post.composer.posting")
                  : t("schedule.sending")
              }
            />
          )}
          <div
            className={`${ui["base-component"]} ${ui["toolbar"]} ${ui["toolbar-align"]} ${ui["toolbar-align-between"]}`}
          >
            <div className={`${ui["base-component"]}`}>
              {/* page表示では入力が空のとき（クリア対象がないため）非表示にする */}
              {(variant === "dialog" || hasTextInput) && (
                <button
                  type="button"
                  className={`${ui["base-button"]} ${ui["text-button"]} ${ui["white-button"]} ${ui["compact-button"]}`}
                  aria-label={t("common.cancel")}
                  disabled={isSubmitting}
                  onClick={requestClose}
                >
                  {t("common.cancel")}
                </button>
              )}
            </div>
            <div className={`${ui["base-component"]}`}>
              <button
                type="button"
                className={`${ui["base-button"]} ${ui["text-button"]} ${ui["white-button"]} ${ui["compact-button"]}`}
                disabled={isSubmitting || guestMode}
                title={guestMode ? t("post.guestUnavailable") : undefined}
                onClick={() => {
                  void openDraftPicker()
                }}
              >
                {t("post.composer.drafts")}
              </button>
              <button
                form={entryFormId}
                className={`${ui["base-button"]} ${ui["text-button"]} ${ui["blue-button"]} ${ui["compact-button"]}`}
                type="submit"
                disabled={isSubmitting || !canSubmitNow}
                data-testid="composer-submit"
                title={
                  guestMode
                    ? t("post.composer.guestSubmitNotice")
                    : target.kind !== "post" && hasVideo
                      ? t("schedule.unavailableVideo")
                      : undefined
                }
              >
                {t(submitLabelKey(scheduleMode, isThread))}
              </button>
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
                canAddSegment={segments.length < MAX_THREAD_POST_COUNT}
                submitBlockedReason={
                  videoPending === "uploading"
                    ? "video.submit.waitUpload"
                    : videoPending === "error"
                      ? "video.submit.removeFailed"
                      : null
                }
                onAddSegment={handleAddSegment}
                onRemove={() => handleRemoveSegment(index)}
                onChange={next => {
                  setSegments(prev =>
                    prev.map((s, i) => (i === index ? next : s)),
                  )
                  if (index === 0) setLanguageCode(next.languageCode)
                }}
                onRequestSubmit={() => entryFormRef.current?.requestSubmit()}
                runAtPicker={
                  index === activeIndex ? (
                    <RunAtPicker
                      value={scheduledRunAt}
                      limits={scheduleAvailable ? scheduleLimits : null}
                      disabled={
                        isSubmitting ||
                        (guestMode && !scheduleAvailable) ||
                        (hasVideo && scheduledRunAt === null)
                      }
                      disabledReason={scheduleUnavailableReason}
                      onUnavailable={
                        // 予約投稿が無効（未登録）のときは設定への案内を、許可が無効になった
                        // ときはこの画面のまま再度の許可のダイアログを出す
                        guestMode
                          ? undefined
                          : scheduleRegistered === false
                            ? () => setSetupGuideOpen(true)
                            : scheduleRegistered === true &&
                                scheduleReauthRequired
                              ? () => setReauthOpen(true)
                              : undefined
                      }
                      open={runAtPickerOpen}
                      onOpenChange={setRunAtPickerOpen}
                      expiresAt={scheduleAvailable ? scheduleExpiresAt : null}
                      slots={
                        pendingCount !== null && scheduleLimits
                          ? {
                              used: pendingCount,
                              max: scheduleLimits.maxPending,
                              // 編集中の予約は、すでに枠を使っている
                              consumes: scheduleMode.kind !== "editing",
                            }
                          : null
                      }
                      onChange={next => void handleRunAtChange(next)}
                    />
                  ) : undefined
                }
                scheduled={scheduledRunAt !== null}
                counterTargets={counterTargets}
                estimatedEntryUrl={estimatedEntryUrl}
              />
            ))}

            {scheduledRunAt && (
              <div className={`${ui["base-component"]} ${ui["toolbar"]}`}>
                <button
                  type="button"
                  className={`${ui["base-button"]} ${ui["text-button"]} ${ui["white-button"]}`}
                  data-testid="schedule-run-at-label"
                  disabled={isSubmitting}
                  onClick={() =>
                    // 許可が無効になっているときは、日時の指定の代わりに再度の許可を案内する
                    scheduleReauthRequired
                      ? setReauthOpen(true)
                      : setRunAtPickerOpen(true)
                  }
                >
                  {t("schedule.runAtLabel", {
                    date: formatRunAtLabel(scheduledRunAt, locale),
                  })}
                </button>
              </div>
            )}

            <div className={`${ui["base-padding"]} ${ui["toggle-box"]}`}>
              <ToggleSwitch
                checked={shareToggles.manualImageAttach}
                disabled={isSubmitting}
                label={t("post.composer.manualImageAttach")}
                onCheckedChange={shareToggles.onManualImageAttachChange}
              />
              <ToggleSwitch
                checked={shareToggles.preferSkyshareLinkCard}
                disabled={isSubmitting || shareToggles.manualImageAttach}
                label={t("post.composer.linkCardPriority")}
                onCheckedChange={shareToggles.onPreferSkyshareLinkCardChange}
              />
            </div>

            <div className={ui["base-component"]}>
              {/* 情報の密度を下げるため、設定値によらず常に閉じた状態で表示する */}
              <Collapsible label={t("post.composer.moreOptions")}>
                <div className={ui["toggle-box"]}>
                  <ToggleSwitch
                    checked={shareToggles.popupIntentInsteadOfWebshare}
                    disabled={isSubmitting}
                    label={renderSlots(raw("post.composer.popupInstead"), {
                      share: <InlineIcon name="share" />,
                      popup: <InlineIcon name="popup" />,
                    })}
                    onCheckedChange={
                      shareToggles.onPopupIntentInsteadOfWebshareChange
                    }
                  />
                  {shareToggles.popupIntentInsteadOfWebshare && (
                    <div className={styles["auto-popup-target-row"]}>
                      <label htmlFor={`${entryFormId}-auto-popup-target`}>
                        {t("post.autoPopupTarget.label")}
                      </label>
                      <AutoPopupTargetSelect
                        id={`${entryFormId}-auto-popup-target`}
                        ariaLabel={t("post.autoPopupTarget.label")}
                        value={shareToggles.autoPopupTarget}
                        disabled={isSubmitting}
                        onChange={shareToggles.onAutoPopupTargetChange}
                      />
                    </div>
                  )}
                  <ToggleSwitch
                    checked={shareToggles.truncateIntentText}
                    disabled={isSubmitting || shareToggles.manualImageAttach}
                    label={t("post.composer.truncateIntentText")}
                    onCheckedChange={shareToggles.onTruncateIntentTextChange}
                  />
                  <ToggleSwitch
                    checked={syncGateDefaultAfterPost}
                    disabled={isSubmitting}
                    label={t("settings.syncGate.label")}
                    onCheckedChange={next => {
                      setSyncGateDefaultAfterPost(next)
                      writeSyncGateDefaultAfterPostSetting(next)
                    }}
                  />
                  <ToggleSwitch
                    checked={effectivePinnedFormDisabled}
                    disabled={isSubmitting || timelineHidden}
                    label={t("settings.pinnedFormDisabled.label")}
                    onCheckedChange={next => {
                      setPinnedFormDisabled(next)
                      writePinnedFormDisabledSetting(next)
                      onPinnedFormDisabledChange?.(next)
                    }}
                  />
                </div>
              </Collapsible>
            </div>
            {status !== null && (
              <div
                id="status"
                aria-live="polite"
                className={`${ui["base-component"]} ${ui["toolbar"]}`}
                style={{ color: statusColor }}
              >
                {status.format(translator)}
              </div>
            )}
          </form>
        </div>

        <IntentShareDialog
          request={shareRequest}
          keepOpenOnSelect
          onClose={() => setShareRequest(null)}
        />
      </>
    )
  },
)

export default Component
