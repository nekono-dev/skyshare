import { useEffect, useState } from "react"
import ChoiceDialog from "@/components/common/ChoiceDialog"
import { useT } from "@/lib/i18n/react"
import { readAuthorizationFragment } from "@/lib/oauth/callbackFragment"
import { notifyScheduleCredentialChange } from "@/lib/schedule/useScheduleAvailability"

/**
 * 予約投稿の許可の画面から戻ったときの完了と結果の表示（全ページ共通）。
 *
 * 責務と処理概要:
 * - 戻り先（`/oauth/callback/`）は、許可を始めたページの住所のフラグメントに戻りの項目を入れて転送する。
 *   このフラグメントを読んだら、再読み込みで同じ項目を送らないよう先に住所から消し、
 *   認可の完了の API を呼んで、結果をダイアログで表示する。
 * - 成功したら、同じページの設定のスイッチと投稿フォームへ登録状態の変更を知らせる。
 *
 * 実装上の制約:
 * - すべてのページに置くため、API のクライアントは戻りの項目があるときだけ読み込む。
 * - 戻りは別のサイトからの遷移でセッションの cookie が届かないため、完了はこのページから呼ぶ。
 */

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
