/**
 * スレッド投稿フォームの状態と画面を統合する。
 *
 * - クロスポストの対象は先頭セグメントのみ。
 * - SSR と hydration の一致のため、設定値はマウント後に反映する。
 */
import { useLocale, useT } from "@/components/i18n/useTranslation"
import { renderSlots } from "@/components/i18n/renderSlots"
import { type DeferredMessage } from "@/lib/i18n/translate"
import React, {
  forwardRef,
  useEffect,
  useId,
  useImperativeHandle,
  useRef,
  useState,
} from "react"
import Collapsible from "@/components/common/section/Collapsible"
import DraftListPanel from "@/components/composer/ThreadComposer/DraftListPanel"
import DraftSaveConfirmDialog from "@/components/composer/ThreadComposer/DraftSaveConfirmDialog"
import InlineIcon from "@/components/common/InlineIcon"
import Loading from "@/components/common/Loading"
import Overlay from "@/components/common/dialog/Overlay"
import ToggleSwitch from "@/components/common/input/ToggleSwitch"
import { MAX_THREAD_POST_COUNT } from "@/lib/atproto/post"
import {
  readPostGateDefaultSetting,
  readSyncGateDefaultAfterPostSetting,
  writeSyncGateDefaultAfterPostSetting,
} from "@/lib/settings/postGateSettings"
import {
  readPinnedFormDisabledSetting,
  writePinnedFormDisabledSetting,
} from "@/lib/settings/shareSettings"
import { readTimelineHiddenSetting } from "@/lib/settings/timelineSettings"
import {
  readHashtagSuggestEnabledSetting,
  readMentionSuggestEnabledSetting,
} from "@/lib/settings/suggestSettings"
import IntentShareDialog, {
  type IntentShareRequest,
} from "@/components/share/IntentShareDialog"
import AutoPopupTargetSelect from "@/components/common/select/AutoPopupTargetSelect"
import ChoiceDialog from "@/components/common/dialog/ChoiceDialog"
import TabButtons, {
  panelId,
  tabId,
} from "@/components/common/section/TabButtons"
import RunAtPicker from "@/components/composer/ThreadComposer/RunAtPicker"
import CredentialDialog from "@/components/schedule/CredentialDialog"
import ScheduleList from "@/components/composer/ThreadComposer/ScheduleList"
import { formatRunAtLabel } from "@/lib/schedule/runAtInput"
import {
  runAtOf,
  submitLabelKey,
  submitTarget,
} from "@/lib/schedule/scheduleMode"
import { submitSchedule } from "@/lib/schedule/submitSchedule"
import { useScheduleAvailability } from "@/components/schedule/ScheduleSetting/useScheduleAvailability"
import { submitThread } from "./rules/submitThread"
import { useShareToggles } from "@/components/settings/Settings/useShareToggles"
import ComposerOptions from "./ComposerOptions"
import ComposerDialogs from "./ComposerDialogs"
import { useDraftFlow } from "./hooks/useDraftFlow"
import { useScheduleEdit } from "./hooks/useScheduleEdit"
import { useScheduleFlow } from "./hooks/useScheduleFlow"
import { useThreadSubmit } from "./hooks/useThreadSubmit"
import { estimateSkyshareEntryUrl } from "@/lib/entry/estimateEntryUrl"
import { resolveCounterTargets } from "@/lib/share/counterReserve"
import ThreadSegmentForm from "./ThreadSegmentForm"
import {
  addSegment,
  areAllSegmentsPostable,
  canRemoveSegment,
  createEmptySegment,
  hasVideoSegment,
  pendingVideoState,
  removeSegment,
  type SegmentState,
} from "./rules/segments"
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
  /**
   * 真のとき、マウント直後に先頭セグメントの本文の入力欄へフォーカスする（既定は偽）。
   * PostLauncher のモーダルのように「開いた直後から入力する」用途で指定する。
   * 常時表示のフォームでは、表示しただけで画面が動いたりスマホのキーボードが出たりしないよう渡さない。
   */
  autoFocus?: boolean
}

/**
 * 親（PostLauncher の Overlay など）から閉じ操作を要求するための命令的ハンドル。
 */
export type ThreadComposerHandle = {
  requestClose: () => void
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
      autoFocus = false,
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
    // （ルートセグメントの設定を「デフォルト」として扱う）。
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
    // 下書き・予約の画面のタブ。開くたびに下書きのタブへ戻す
    const [draftTab, setDraftTab] = useState<"drafts" | "schedules">("drafts")
    const locale = useLocale()
    const {
      registered: scheduleRegistered,
      reauthRequired: scheduleReauthRequired,
      expiresAt: scheduleExpiresAt,
      limits: scheduleLimits,
      reload: reloadScheduleAvailability,
    } = useScheduleAvailability(!guestMode)
    const rootSegment = segments[0]
    const hasTextInput = segments.some(s => s.text.trim().length > 0)
    const isThread = segments.length > 1
    const {
      scheduleMode,
      setScheduleMode,
      runAtPickerOpen,
      setRunAtPickerOpen,
      pendingCount,
      setPendingCount,
      editChoiceOpen,
      setEditChoiceOpen,
      editChoiceBusy,
      setEditChoiceBusy,
      scheduleLoading,
      setScheduleLoading,
      restoredFailedId,
      setRestoredFailedId,
      setupGuideOpen,
      setSetupGuideOpen,
      reauthOpen,
      setReauthOpen,
      deleteRestoredFailedSilently,
      handleRunAtChange,
    } = useScheduleFlow({
      setStatus,
      setStatusColor,
    })

    const {
      draftModalOpen,
      setDraftModalOpen,
      draftItems,
      setDraftItems,
      draftListLoading,
      setDraftListLoading,
      draftListError,
      setDraftListError,
      loadedDraft,
      setLoadedDraft,
      draftSaveConfirmOpen,
      setDraftSaveConfirmOpen,
      pendingNavigation,
      setPendingNavigation,
      isSavingDraft,
      setIsSavingDraft,
      resetInputFields,
      openDraftPicker,
      applyDraftToForm,
      deleteDraftSilently,
      hasUnsavedDraftChanges,
      closeForm,
      goTo,
      finishAfterDraftConfirm,
      requestNavigation,
      goToPendingNavigation,
      handleSaveDraftAndClose,
      handleDiscardDraftAndClose,
      requestClose,
    } = useDraftFlow({
      variant,
      onClose,
      segments,
      setSegments,
      setActiveIndex,
      languageCode,
      hasTextInput,
      scheduleMode,
      setScheduleMode,
      setRestoredFailedId,
      setEditChoiceOpen,
      setDraftTab,
      setStatus,
      setStatusColor,
    })
    const { handleCancelScheduleAndClose, applyScheduleToForm } =
      useScheduleEdit({
        segments,
        setSegments,
        setActiveIndex,
        languageCode,
        setLanguageCode,
        scheduleMode,
        setScheduleMode,
        setRestoredFailedId,
        setEditChoiceOpen,
        setEditChoiceBusy,
        setScheduleLoading,
        setLoadedDraft,
        setDraftModalOpen,
        setPendingNavigation,
        setStatus,
        setStatusColor,
        closeForm,
        goToPendingNavigation,
      })
    // 予約の UI（日時の指定・予約のタブ）を開くたびに、cookie のヒントを使わず登録状態を取り直す
    useEffect(() => {
      if (runAtPickerOpen) reloadScheduleAvailability()
    }, [runAtPickerOpen, reloadScheduleAvailability])
    useEffect(() => {
      if (draftModalOpen && draftTab === "schedules") {
        reloadScheduleAvailability()
      }
    }, [draftModalOpen, draftTab, reloadScheduleAvailability])
    const formRef = useRef<HTMLDivElement>(null)
    const entryFormRef = useRef<HTMLFormElement>(null)
    // マウント時だけ先頭の本文の入力欄へフォーカスする。入力欄が未描画なら何もしない。
    // スクロール位置を動かさない（preventScroll）のは、モーダルを開いた直後に背面や
    // フォームが跳ねないようにするため。
    useEffect(() => {
      if (!autoFocus) return
      entryFormRef.current
        ?.querySelector<HTMLElement>("[data-post-body-editor]")
        ?.focus({ preventScroll: true })
    }, [autoFocus])

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
    const { isSubmitting, handleScheduleSubmit, handleSubmit } =
      useThreadSubmit({
        segments,
        rootSegment,
        setStatus,
        setStatusColor,
        target,
        canSubmitNow,
        guestMode,
        accountDid,
        shareToggles,
        syncGateDefaultAfterPost,
        loadedDraft,
        setLoadedDraft,
        setScheduleMode,
        setShareRequest,
        onShareRequest,
        onPosted,
        resetInputFields,
        deleteDraftSilently,
        deleteRestoredFailedSilently,
      })

    return (
      <>
        <ComposerDialogs
          applyDraftToForm={applyDraftToForm}
          closeForm={closeForm}
          draftItems={draftItems}
          draftListError={draftListError}
          draftListLoading={draftListLoading}
          draftModalOpen={draftModalOpen}
          setDraftModalOpen={setDraftModalOpen}
          draftSaveConfirmOpen={draftSaveConfirmOpen}
          setDraftSaveConfirmOpen={setDraftSaveConfirmOpen}
          goToPendingNavigation={goToPendingNavigation}
          handleSaveDraftAndClose={handleSaveDraftAndClose}
          handleDiscardDraftAndClose={handleDiscardDraftAndClose}
          isSavingDraft={isSavingDraft}
          setPendingNavigation={setPendingNavigation}
          setDraftItems={setDraftItems}
          requestNavigation={requestNavigation}
          editChoiceOpen={editChoiceOpen}
          setEditChoiceOpen={setEditChoiceOpen}
          editChoiceBusy={editChoiceBusy}
          scheduleLoading={scheduleLoading}
          setupGuideOpen={setupGuideOpen}
          setSetupGuideOpen={setSetupGuideOpen}
          reauthOpen={reauthOpen}
          setReauthOpen={setReauthOpen}
          entryFormId={entryFormId}
          draftTab={draftTab}
          setDraftTab={setDraftTab}
          scheduleRegistered={scheduleRegistered}
          applyScheduleToForm={applyScheduleToForm}
          handleCancelScheduleAndClose={handleCancelScheduleAndClose}
          shareRequest={shareRequest}
          setShareRequest={setShareRequest}
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

            <ComposerOptions
              entryFormId={entryFormId}
              isSubmitting={isSubmitting}
              shareToggles={shareToggles}
              syncGateDefaultAfterPost={syncGateDefaultAfterPost}
              onSyncGateDefaultAfterPostChange={next => {
                setSyncGateDefaultAfterPost(next)
                writeSyncGateDefaultAfterPostSetting(next)
              }}
              effectivePinnedFormDisabled={effectivePinnedFormDisabled}
              timelineHidden={timelineHidden}
              onPinnedFormDisabledChange={next => {
                setPinnedFormDisabled(next)
                writePinnedFormDisabledSetting(next)
                onPinnedFormDisabledChange?.(next)
              }}
            />
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
      </>
    )
  },
)

export default Component
