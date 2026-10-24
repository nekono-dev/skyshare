import { useEffect, useState } from "react"
import ChoiceDialog from "@/components/common/ChoiceDialog"
import { clearKnownUnauthenticated } from "@/lib/account/activeAccountSession"
import { useT } from "@/lib/i18n/react"
import type { PlainMessageKey } from "@/lib/i18n/translate"
import { readAuthorizationFragment } from "@/lib/oauth/callbackFragment"

/**
 * Bluesky の OAuth のログインの画面から戻ったときの完了と結果の表示（ログインとアカウントのページ）。
 *
 * 責務と処理概要:
 * - 戻り先（`/oauth/callback/`）は、ログインを始めたページの住所のフラグメントに、用途 `session` と
 *   戻りの項目を入れて転送する。このフラグメントを読んだら、再読み込みで同じ項目を送らないよう
 *   先に住所から消し、ログインの完了の API を呼んで、結果をダイアログで表示する。
 * - 成功したら、未ログインの記録を消して一定時間の後にトップへ遷移する（パスワードのログインと同じ）。
 *
 * 実装上の制約:
 * - 戻りは別のサイトからの遷移で `SameSite=Strict` の cookie が届かないため、完了はこのページから呼ぶ。
 * - API のクライアントは戻りの項目があるときだけ読み込む。
 */

/** 成功の表示から遷移までの時間（パスワードのログインと同じ） */
const REDIRECT_DELAY_MS = 700

/**
 * 完了の結果から、表示する文言のキーを決める。
 *
 * Input: `result`（完了の応答の分類。`limit` はアカウント数の上限の 409、`failed` は通信の失敗など）
 * Output: 文言のキー。未知の分類は汎用の失敗
 *
 * 例:
 * - 入力: `"ok"` → 出力: `"account.oauthResult.ok"`
 * - 入力: `"StateInvalid"` → 出力: `"account.oauthResult.retry"`
 */
export const loginResultKey = (result: string): PlainMessageKey => {
  switch (result) {
    case "ok":
      return "account.oauthResult.ok"
    case "Denied":
      return "account.oauthResult.Denied"
    case "StateInvalid":
    case "IssuerMismatch":
      return "account.oauthResult.retry"
    case "AccountUnverified":
      return "account.oauthResult.AccountUnverified"
    case "limit":
      return "error.accountLimitReached"
    default:
      return "account.oauthResult.failed"
  }
}

export const Component = () => {
  const { t } = useT()
  const [result, setResult] = useState<string | null>(null)

  useEffect(() => {
    const returned = readAuthorizationFragment(window.location.hash, "session")
    if (!returned) return
    const url = new URL(window.location.href)
    url.hash = ""
    window.history.replaceState(window.history.state, "", url.toString())
    let cancelled = false
    void (async () => {
      let next: string
      try {
        const { completeSessionAuthorization } =
          await import("@/client/openapi/client")
        const res = await completeSessionAuthorization(returned)
        next =
          res.status === 200
            ? res.data.result
            : res.status === 409
              ? "limit"
              : "failed"
      } catch {
        next = "failed"
      }
      if (cancelled) return
      setResult(next)
      if (next === "ok") {
        clearKnownUnauthenticated()
        setTimeout(() => {
          window.location.href = "/"
        }, REDIRECT_DELAY_MS)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <ChoiceDialog
      open={result !== null}
      onClose={() => setResult(null)}
      ariaLabel={t("account.oauthResult.title")}
      description={result === null ? undefined : t(loginResultKey(result))}
      buttons={[
        {
          key: "close",
          label: t("account.oauthResult.close"),
          variant: "blue",
          onClick: () => setResult(null),
        },
      ]}
    />
  )
}

export default Component
