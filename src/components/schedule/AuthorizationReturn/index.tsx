/**
 * 予約投稿の OAuth 戻りを完了し、結果を全ページ共通で表示する。
 *
 * - 戻り値は再送防止のため先に URL から除き、SameSite cookie が届かない OAuth 戻りはこのページから完了する。
 * - API クライアントは戻り値がある場合だけ読み込む。
 */
import { useEffect, useState } from "react"
import ChoiceDialog from "@/components/common/dialog/ChoiceDialog"
import { useT } from "@/components/i18n/useTranslation"
import { readAuthorizationFragment } from "@/lib/oauth/callbackFragment"
import { notifyScheduleCredentialChange } from "@/components/schedule/ScheduleSetting/useScheduleAvailability"

/**
 * 認可の戻りの結果から、表示する文言のキーを決める。
 *
 * Example: `authResultKey("ok")` → `"schedule.authResult.ok"`、未知の分類は汎用の失敗の文言
 */
export const authResultKey = (
  result: string,
):
  | "schedule.authResult.ok"
  | "schedule.authResult.Denied"
  | "schedule.authResult.AccountMismatch"
  | "schedule.authResult.SessionRequired"
  | "schedule.authResult.failed" => {
  switch (result) {
    case "ok":
      return "schedule.authResult.ok"
    case "Denied":
      return "schedule.authResult.Denied"
    case "AccountMismatch":
      return "schedule.authResult.AccountMismatch"
    case "SessionRequired":
      return "schedule.authResult.SessionRequired"
    default:
      return "schedule.authResult.failed"
  }
}

export const Component = () => {
  const { t } = useT()
  const [result, setResult] = useState<string | null>(null)

  useEffect(() => {
    const returned = readAuthorizationFragment(window.location.hash, "schedule")
    if (!returned) return
    const url = new URL(window.location.href)
    url.hash = ""
    window.history.replaceState(window.history.state, "", url.toString())
    let cancelled = false
    void (async () => {
      let next: string
      try {
        const { completeScheduleAuthorization } =
          await import("@/client/openapi/client")
        const res = await completeScheduleAuthorization(returned)
        next =
          res.status === 200
            ? res.data.result
            : res.status === 401
              ? "SessionRequired"
              : "failed"
      } catch {
        next = "failed"
      }
      if (cancelled) return
      setResult(next)
      if (next === "ok") notifyScheduleCredentialChange()
    })()
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <ChoiceDialog
      open={result !== null}
      onClose={() => setResult(null)}
      ariaLabel={t("schedule.authResult.title")}
      description={result === null ? undefined : t(authResultKey(result))}
      buttons={[
        {
          key: "close",
          label: t("schedule.authResult.close"),
          variant: "blue",
          onClick: () => setResult(null),
        },
      ]}
    />
  )
}

export default Component
