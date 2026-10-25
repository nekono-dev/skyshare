import { useEffect, useState } from "react"
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
 *   先に住所から消し、ログインの完了の API を呼んで、進行と結果をステータスメッセージで表示する
 *   （アプリパスワードのログインと同じ表示）。
 * - 成功したら、未ログインの記録を消して一定時間の後にトップへ遷移する（パスワードのログインと同じ）。
 * - `<html data-oauth-returning>` は、Baselayout の先頭のスクリプトが戻りの住所を見て `pending` で付ける。
 *   付いている間はログインのフォームを押せず、`pending` の間はこの部品が動く前の「ログイン中…」を出す
 *   （`LoginAuthorizationStatus.astro`）。この部品は動き出したら `active` に変えて表示を引き継ぎ、
 *   失敗したら外してやり直せるようにする。成功したら遷移まで付けたままにする。
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

/** 戻りの完了の状態。`progress` は完了の依頼中、それ以外は完了の結果の分類 */
type ReturnState = "progress" | string

export const Component = () => {
  const { t } = useT()
  const [state, setState] = useState<ReturnState | null>(null)

  useEffect(() => {
    const root = document.documentElement
    const returned = readAuthorizationFragment(window.location.hash, "session")
    if (!returned) {
      delete root.dataset.oauthReturning
      return
    }
    root.dataset.oauthReturning = "active"
    setState("progress")
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
      setState(next)
      if (next !== "ok") delete root.dataset.oauthReturning
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

  if (state === null) return null
  const color =
    state === "progress" ? undefined : state === "ok" ? "green" : "#b00"
  return (
    <div id="oauth-login-status" aria-live="polite" style={{ color }}>
      {state === "progress"
        ? t("account.login.progress")
        : t(loginResultKey(state))}
    </div>
  )
}

export default Component
