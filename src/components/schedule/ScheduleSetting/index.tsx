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
 * - オフにすると待機中の予約と失敗の履歴の件数を示して確認し、承諾されたらそれらを削除して
 *   認証情報を削除する。実行中の予約があるときは削除されず、理由を表示する。
 * - 登録・削除の後は、同じページの投稿フォームへ変更を知らせる。
 * - ゲストの表示と、登録状態の取得前・取得の失敗の間は、スイッチを押せない。
 * - スイッチの説明文の末尾に、予約できる投稿の注（画像のみ対応をアイコンで示す）を続ける。
 * - スイッチの下に、動画の予約投稿や高度な機能の受け皿として、予約投稿サービス（Chronosky）への
 *   案内をロゴつきで置く。
 */

export const Component = () => {
  const translator = useT()
  const { t, raw } = translator
  const guestMode = isGuestModeRequested()
  const { registered, reauthRequired } = useScheduleAvailability(
    !guestMode,
    true,
  )
  const [credentialOpen, setCredentialOpen] = useState(false)
  const [disableCount, setDisableCount] = useState<{
    pending: number
    failed: number
  } | null>(null)
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState<{
    message: DeferredMessage
    error: boolean
  } | null>(null)

  /** 登録状態の変更を、このスイッチと同じページの投稿フォームへ反映する（通知で全員が取り直す） */
  const changed = () => {
    notifyScheduleCredentialChange()
  }

  /**
   * オフにする前に、削除される待機中の予約と失敗の履歴の件数を数えて確認を開く。
   * 一覧を続きまで取得して数える。取得に失敗したら、確認を開かずにエラーを表示する。
   */
  const confirmDisable = async () => {
    setStatus(null)
    try {
      const count = { pending: 0, failed: 0 }
      let cursor: string | undefined
      do {
        const res = await listSchedules({ limit: 50, cursor })
        if (res.status !== 200) {
          setStatus({
            message: deferMessage(scheduleErrorKey(res.status)),
            error: true,
          })
          return
        }
        for (const item of res.data.items) {
          if (item.status === "pending") count.pending += 1
          if (item.status === "failed") count.failed += 1
        }
        cursor = res.data.cursor
      } while (cursor)
      setDisableCount(count)
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
      const deleted = res.data.cancelled + res.data.deletedHistory
      setStatus({
        message:
          deleted > 0
            ? {
                format: tr =>
                  tr.t("schedule.setting.disabledWithDelete", {
                    count: deleted,
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

  /** オフの確認の文言。削除される待機中の予約と失敗の履歴の有無で選ぶ */
  const disableMessage = (
    count: { pending: number; failed: number } | null,
  ) => {
    if (!count) return ""
    const { pending, failed } = count
    if (pending > 0 && failed > 0)
      return t("schedule.setting.disableMessage", { pending, failed })
    if (pending > 0)
      return t("schedule.setting.disableMessagePending", { count: pending })
    if (failed > 0)
      return t("schedule.setting.disableMessageFailed", { count: failed })
    return t("schedule.setting.disableMessageNone")
  }

  return (
    <>
      <SettingList
        items={[
          {
            key: "scheduledPost",
            label: t("schedule.setting.label"),
            description: renderSlots(raw("schedule.setting.description"), {
              image: (
                <InlineIcon
                  name="image"
                  alt={t("schedule.setting.mediaImageAlt")}
                />
              ),
            }),
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
      <p className={styles.chronosky} data-testid="schedule-chronosky">
        {renderSlots(raw("schedule.setting.chronoskyLead"), {
          video: (
            <InlineIcon
              name="video"
              alt={t("schedule.setting.mediaVideoAlt")}
            />
          ),
          // ロゴはリンクの直前に文中へ埋め込む（装飾のため alt は空）
          link: (
            <>
              <img
                src={chronoskyLogo.src}
                width={18}
                height={18}
                alt=""
                className={styles["chronosky-logo"]}
              />
              <a
                href="https://chronosky.app/"
                target="_blank"
                rel="noopener noreferrer"
                aria-label={t("schedule.setting.chronoskyAria")}
              >
                {t("schedule.setting.chronoskyName")}
              </a>
            </>
          ),
        })}
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
        onClose={() => setCredentialOpen(false)}
      />
      <ConfirmDialog
        open={disableCount !== null}
        onClose={() => setDisableCount(null)}
        ariaLabel={t("schedule.setting.disableTitle")}
        title={t("schedule.setting.disableTitle")}
        message={disableMessage(disableCount)}
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
