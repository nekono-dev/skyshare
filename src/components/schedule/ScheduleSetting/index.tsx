import { useState } from "react"
import {
  deleteScheduleCredential,
  listSchedules,
} from "@/client/openapi/client"
import ConfirmDialog from "@/components/common/ConfirmDialog"
import CredentialDialog from "@/components/schedule/CredentialDialog"
import SettingList from "@/components/settings/SettingList"
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
 * - オンにすると認証情報の入力のダイアログを開き、登録に成功したときだけオンになる。
 * - オフにすると待機中の予約の件数を示して確認し、承諾されたら待機中の予約を取り消して
 *   認証情報を削除する。実行中の予約があるときは削除されず、理由を表示する。
 * - 登録・削除の後は、同じページの投稿フォームへ変更を知らせる。
 * - ゲストの表示と、登録状態の取得前・取得の失敗の間は、スイッチを押せない。
 */

export const Component = () => {
  const translator = useT()
  const { t } = translator
  const guestMode = isGuestModeRequested()
  const { registered, reload } = useScheduleAvailability(!guestMode)
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
        onRegistered={() => {
          setCredentialOpen(false)
          changed()
        }}
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
