import { useState } from "react"
import chronoskyLogo from "@/images/chronosky.svg"
import InlineIcon from "@/components/common/InlineIcon"
import { renderSlots } from "@/lib/i18n/rich"
import {
  deleteScheduleCredential,
  listSchedules,
} from "@/client/openapi/client"
import ConfirmDialog from "@/components/common/ConfirmDialog"
import CredentialDialog from "@/components/schedule/CredentialDialog"
import SettingList from "@/components/settings/SettingList"
import styles from "./index.module.css"
import ui from "@/styles/ui.module.css"
import { isGuestModeRequested } from "@/lib/guestMode"
import { useT } from "@/lib/i18n/react"
import { deferMessage, type DeferredMessage } from "@/lib/i18n/translate"
import { scheduleErrorKey } from "@/lib/schedule/scheduleErrorKey"
import {
  notifyScheduleCredentialChange,
  useScheduleAvailability,
} from "@/lib/schedule/useScheduleAvailability"

/**
 * 設定画面の「予約投稿」のスイッチ。
 *
 * 責務と処理概要:
 * - スイッチの状態は、サーバーの予約用の認証情報の登録の有無に従う（端末には保存しない）。
 * - オンにすると Bluesky の認可へ送るダイアログを開く。認可の画面から戻ったときの完了と
 *   結果の表示は、全ページ共通の `AuthorizationReturn` が行い、登録状態の変更を知らせる。
 * - 許可が無効になっても（再度の許可が必要な印）スイッチはオンのまま、再度の許可を案内し、
 *   ボタンから同じダイアログを再度の許可として開く。
 * - オフにすると待機中の予約の件数を示して確認し、承諾されたら待機中の予約を取り消して
 *   認証情報を削除する。実行中の予約があるときは削除されず、理由を表示する。
 * - 登録・削除の後は、同じページの投稿フォームへ変更を知らせる。
 * - ゲストの表示と、登録状態の取得前・取得の失敗の間は、スイッチを押せない。
 * - スイッチの下に、予約できる投稿の注（画像は可・動画は不可をアイコンで示す）と、
 *   本格的な予約投稿サービス（Chronosky）への案内をロゴつきで置く。
 */

export const Component = () => {
  const translator = useT()
  const { t, raw } = translator
  const guestMode = isGuestModeRequested()
  const { registered, reauthRequired, reload } =
    useScheduleAvailability(!guestMode)
  const [credentialOpen, setCredentialOpen] = useState(false)
  const [disableCount, setDisableCount] = useState<number | null>(null)
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState<{
    message: DeferredMessage
    error: boolean
  } | null>(null)

  /** 登録状態の変更を、このスイッチと同じページの投稿フォームへ反映する */
  const changed = () => {
    reload()
    notifyScheduleCredentialChange()
  }

  /**
   * オフにする前に、取り消される待機中の予約の件数を数えて確認を開く。
   * 件数の取得に失敗したら、確認を開かずにエラーを表示する。
   */
  const confirmDisable = async () => {
    setStatus(null)
    try {
      const res = await listSchedules({ status: "pending", limit: 50 })
      if (res.status !== 200) {
        setStatus({
          message: deferMessage(scheduleErrorKey(res.status)),
          error: true,
        })
        return
      }
      setDisableCount(res.data.items.length)
    } catch {
      setStatus({ message: deferMessage("error.network"), error: true })
    }
  }

  /** 確認の承諾後に認証情報を削除する。実行中の予約があると 409 になり、オンのまま残る */
  const disable = async () => {
    setBusy(true)
    try {
      const res = await deleteScheduleCredential()
      if (res.status !== 200) {
        const code = "error" in res.data ? res.data.error : undefined
        setStatus({
          message: deferMessage(scheduleErrorKey(res.status, code)),
          error: true,
        })
        return
      }
      const cancelled = res.data.cancelled
      setStatus({
        message:
          cancelled > 0
            ? {
                format: tr =>
                  tr.t("schedule.setting.disabledWithCancel", {
                    count: cancelled,
                  }),
              }
            : deferMessage("schedule.setting.disabled"),
        error: false,
      })
      changed()
    } catch {
      setStatus({ message: deferMessage("error.network"), error: true })
    } finally {
      setBusy(false)
      setDisableCount(null)
    }
  }

  return (
    <>
      <SettingList
        items={[
          {
            key: "scheduledPost",
            label: t("schedule.setting.label"),
            description: t("schedule.setting.description"),
            checked: registered === true,
            disabled: guestMode || registered === null || busy,
            onCheckedChange: next => {
              if (next) {
                setStatus(null)
                setCredentialOpen(true)
              } else {
                void confirmDisable()
              }
            },
          },
        ]}
      />
      {registered === true && reauthRequired && (
        <div className={styles.reauth} data-testid="schedule-reauth">
          <p role="status">{t("schedule.setting.reauthRequired")}</p>
          <button
            type="button"
            className={`${ui["base-button"]} ${ui["text-button"]} ${ui["blue-button"]} ${ui["compact-button"]}`}
            disabled={busy}
            onClick={() => {
              setStatus(null)
              setCredentialOpen(true)
            }}
          >
            {t("schedule.setting.reauthButton")}
          </button>
        </div>
      )}
      <p className={styles.note} data-testid="schedule-media-note">
        {renderSlots(raw("schedule.setting.mediaNote"), {
          image: (
            <InlineIcon
              name="image"
              alt={t("schedule.setting.mediaImageAlt")}
            />
          ),
          video: (
            <InlineIcon
              name="video"
              alt={t("schedule.setting.mediaVideoAlt")}
            />
          ),
        })}
      </p>
      <p className={styles.chronosky} data-testid="schedule-chronosky">
        <img
          src={chronoskyLogo.src}
          width={24}
          height={24}
          alt=""
          className={styles["chronosky-logo"]}
        />
        <span>
          {renderSlots(raw("schedule.setting.chronoskyLead"), {
            link: (
              <a
                href="https://chronosky.app/"
                target="_blank"
                rel="noopener noreferrer"
                aria-label={t("schedule.setting.chronoskyAria")}
              >
                {t("schedule.setting.chronoskyName")}
              </a>
            ),
          })}
        </span>
      </p>
      {status && (
        <p
          role="status"
          aria-live="polite"
          style={{ color: status.error ? "var(--color-red-text)" : undefined }}
        >
          {status.message.format(translator)}
        </p>
      )}
      <CredentialDialog
        open={credentialOpen}
        reauth={reauthRequired}
        onClose={() => setCredentialOpen(false)}
      />
      <ConfirmDialog
        open={disableCount !== null}
        onClose={() => setDisableCount(null)}
        ariaLabel={t("schedule.setting.disableTitle")}
        title={t("schedule.setting.disableTitle")}
        message={
          disableCount
            ? t("schedule.setting.disableMessage", { count: disableCount })
            : t("schedule.setting.disableMessageNone")
        }
        confirmLabel={t("schedule.setting.disableConfirm")}
        confirmVariant="red"
        onConfirm={() => disable()}
        loading={
          busy ? { message: t("schedule.setting.disableTitle") } : undefined
        }
      />
    </>
  )
}
export default Component
