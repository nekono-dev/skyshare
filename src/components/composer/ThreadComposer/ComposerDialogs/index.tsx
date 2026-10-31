import { type Dispatch, type SetStateAction } from "react"
import { useT } from "@/components/i18n/useTranslation"
import Loading from "@/components/common/Loading"
import Overlay from "@/components/common/dialog/Overlay"
import TabButtons, {
  panelId,
  tabId,
} from "@/components/common/section/TabButtons"
import ChoiceDialog from "@/components/common/dialog/ChoiceDialog"
import CredentialDialog from "@/components/schedule/CredentialDialog"
import DraftSaveConfirmDialog from "@/components/composer/ThreadComposer/DraftSaveConfirmDialog"
import DraftListPanel from "@/components/composer/ThreadComposer/DraftListPanel"
import ScheduleList from "@/components/composer/ThreadComposer/ScheduleList"
import IntentShareDialog, {
  type IntentShareRequest,
} from "@/components/share/IntentShareDialog"
import ui from "@/styles/ui.module.css"
import styles from "./index.module.css"
import type { useDraftFlow } from "../hooks/useDraftFlow"
import type { useScheduleFlow } from "../hooks/useScheduleFlow"

type DraftFlow = ReturnType<typeof useDraftFlow>
type ScheduleFlow = ReturnType<typeof useScheduleFlow>

type Props = Pick<
  DraftFlow,
  | "applyDraftToForm"
  | "closeForm"
  | "draftItems"
  | "draftListError"
  | "draftListLoading"
  | "draftModalOpen"
  | "setDraftModalOpen"
  | "draftSaveConfirmOpen"
  | "setDraftSaveConfirmOpen"
  | "goToPendingNavigation"
  | "handleSaveDraftAndClose"
  | "handleDiscardDraftAndClose"
  | "isSavingDraft"
  | "setPendingNavigation"
  | "setDraftItems"
  | "requestNavigation"
> &
  Pick<
    ScheduleFlow,
    | "editChoiceOpen"
    | "setEditChoiceOpen"
    | "editChoiceBusy"
    | "scheduleLoading"
    | "setupGuideOpen"
    | "setSetupGuideOpen"
    | "reauthOpen"
    | "setReauthOpen"
  > & {
    entryFormId: string
    draftTab: "drafts" | "schedules"
    setDraftTab: Dispatch<SetStateAction<"drafts" | "schedules">>
    scheduleRegistered: boolean | null
    applyScheduleToForm: (id: string) => Promise<void>
    handleCancelScheduleAndClose: () => Promise<void>
    shareRequest: IntentShareRequest | null
    setShareRequest: Dispatch<SetStateAction<IntentShareRequest | null>>
  }

/**
 * 投稿フォームのダイアログ群（読み込み中の表示・下書きと予約の一覧・確認・認証・共有）を描画する。
 * 開閉の状態と処理は投稿フォームの本体（フック）が持ち、この部品は描画と操作の受け渡しだけを行う。
 */
const ComposerDialogs = (props: Props) => {
  const {
    applyDraftToForm,
    closeForm,
    draftItems,
    draftListError,
    draftListLoading,
    draftModalOpen,
    setDraftModalOpen,
    draftSaveConfirmOpen,
    setDraftSaveConfirmOpen,
    goToPendingNavigation,
    handleSaveDraftAndClose,
    handleDiscardDraftAndClose,
    isSavingDraft,
    setPendingNavigation,
    setDraftItems,
    requestNavigation,
    editChoiceOpen,
    setEditChoiceOpen,
    editChoiceBusy,
    scheduleLoading,
    setupGuideOpen,
    setSetupGuideOpen,
    reauthOpen,
    setReauthOpen,
    entryFormId,
    draftTab,
    setDraftTab,
    scheduleRegistered,
    applyScheduleToForm,
    handleCancelScheduleAndClose,
    shareRequest,
    setShareRequest,
  } = props
  const { t } = useT()
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
                setDraftItems(prev => prev.filter(item => item.id !== draft.id))
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

      <IntentShareDialog
        request={shareRequest}
        keepOpenOnSelect
        onClose={() => setShareRequest(null)}
      />
    </>
  )
}

export default ComposerDialogs
