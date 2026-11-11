/**
 * Bluesky OAuth とアプリパスワードによるログインを提供する。
 *
 * - OAuth の戻りは SameSite=Strict cookie が届かないため、このページで完了 API を呼ぶ。
 * - フォームは `base-card` 自身であり、入れ子にすると Proton Pass が入力欄を検出できない。
 * - 入力欄には autocomplete と対応する label を設定する。
 */
import React, { useEffect, useState } from "react"
import {
  completeSessionAuthorization,
  createSession,
  startSessionAuthorization,
} from "@/client/openapi/client"
import Collapsible from "@/components/common/section/Collapsible"
import type { CreateSessionBody } from "@/client/openapi/model/createSessionBody"
import { clearKnownUnauthenticated } from "@/lib/session/activeAccountSession"
import { errorMessageKeyFromStatus } from "@/lib/i18n/errorMessage"
import { useT } from "@/components/i18n/useTranslation"
import { renderSlots } from "@/components/i18n/renderSlots"
import type { PlainMessageKey } from "@/lib/i18n/translate"
import { readAuthorizationFragment } from "@/lib/oauth/callbackFragment"
import { publicAuthServer } from "@/env"
import styles from "./index.module.css"
import ui from "@/styles/ui.module.css"

/** 成功の表示から遷移までの時間 */
const REDIRECT_DELAY_MS = 700

/**
 * OAuth のログインの戻りの完了を待っている間か（Baselayout の先頭のスクリプトとこの部品が `<html>` に付ける印）。
 * この間はもう一度ログインを始めさせない（CSS でも押せなくしているが、キーボードの送信も止める）。
 */
const isCompletingOAuthReturn = () =>
  document.documentElement.dataset.oauthReturning !== undefined

/**
 * 戻りの完了の結果から、表示する文言のキーを決める。
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

type Props = {
  /**
   * ハンドルの初期値。再ログイン導線など、対象アカウントが既知の場合に指定する。
   * アプリパスワードのフォームのハンドル欄と、OAuth の開始の入力済みの指定（`loginHint`）に使う。
   */
  initialHandle?: string
}

/**
 * ログインフォームを描画する。
 *
 * Input:
 * - `initialHandle`: ハンドルの初期値（省略時は空欄・入力済みの指定なし）
 *
 * Output:
 * - OAuth のボタン、アプリパスワードのフォームを包む折りたたみ、状態メッセージ表示を含む JSX
 *   （OAuth の戻りの進行と結果も同じ状態メッセージに出す）
 *
 * 例:
 * - 出力: 「Bluesky でログイン」のボタン。折りたたみを開くとハンドル入力・パスワード入力・ログインボタン
 */
export const Component = ({ initialHandle }: Props = {}) => {
  const { t, raw } = useT()
  const [handle, setHandle] = useState(initialHandle ?? "")
  const [password, setPassword] = useState("")
  // 状態メッセージは文言キーで保持し、表示時に翻訳する（言語切り替えに追従させるため）
  const [messageKey, setMessageKey] = useState<PlainMessageKey | "">("")
  const [color, setColor] = useState("")
  const [oauthStarting, setOauthStarting] = useState(false)

  /**
   * 認可の画面からの戻りなら、住所から項目を消してログインの完了を依頼し、進行と結果を表示する。
   *
   * 失敗時の方針:
   * - 完了が `ok` 以外・409・通信例外: 理由の文言を表示し、印を外してフォームを押せるようにする
   */
  useEffect(() => {
    const root = document.documentElement
    const returned = readAuthorizationFragment(window.location.hash, "session")
    if (!returned) {
      delete root.dataset.oauthReturning
      return
    }
    root.dataset.oauthReturning = "active"
    setColor("")
    setMessageKey("account.login.progress")
    const url = new URL(window.location.href)
    url.hash = ""
    window.history.replaceState(window.history.state, "", url.toString())
    void (async () => {
      let result: string
      try {
        const res = await completeSessionAuthorization(returned)
        result =
          res.status === 200
            ? res.data.result
            : res.status === 409
              ? "limit"
              : "failed"
      } catch (err) {
        console.error(err)
        result = "failed"
      }
      setColor(result === "ok" ? "green" : "#b00")
      setMessageKey(loginResultKey(result))
      if (result !== "ok") {
        delete root.dataset.oauthReturning
        return
      }
      clearKnownUnauthenticated()
      setTimeout(() => {
        window.location.href = "/"
      }, REDIRECT_DELAY_MS)
    })()
  }, [])

  /**
   * OAuth のログインを開始し、認可の画面へ遷移する。
   *
   * 処理の趣旨:
   * - 開始のページ（このページのパス）を戻り先に指定し、再ログインなら対象のハンドルを入力済みにする。
   * - 遷移までの間はボタンを押せなくし、二重に開始しない。
   *
   * Output:
   * - 返り値なし（成功時は `window.location` の遷移を副作用として実行）
   *
   * 失敗時の方針:
   * - API が 200 以外: ステータスから文言を選んで表示し、ボタンを戻す
   * - 通信例外: 接続失敗メッセージを表示し、ボタンを戻す
   */
  const startOAuth = async () => {
    if (oauthStarting || isCompletingOAuthReturn()) return
    setOauthStarting(true)
    setColor("")
    setMessageKey("account.login.oauthRedirecting")
    try {
      const res = await startSessionAuthorization({
        returnTo: window.location.pathname,
        ...(initialHandle ? { loginHint: initialHandle } : {}),
      })
      if (res.status === 200) {
        window.location.href = res.data.url
        return
      }
      setColor("#b00")
      setMessageKey(errorMessageKeyFromStatus(res.status, "login"))
    } catch (err) {
      console.error(err)
      setColor("#b00")
      setMessageKey("error.network")
    }
    setOauthStarting(false)
  }

  /**
   * フォーム送信時にセッション作成 API を呼び出す。
   *
   * 処理の趣旨:
   * - 送信直後に進行メッセージへ更新し、二重状態更新を避けるため先に色を初期化する。
   * - API ステータスで成功/失敗を分岐し、失敗時は早期 return で後続処理を止める。
   *
   * Input:
   * - `e`: フォーム送信イベント
   *
   * Output:
   * - 返り値なし（状態更新とページ遷移を副作用として実行）
   *
   * 失敗時の方針:
   * - API が 200 以外: エラーメッセージを表示して終了
   * - 通信例外: 接続失敗メッセージを表示して終了
   *
   * 例:
   * - 入力: 正しい identifier/password
   * - 出力: 成功メッセージ表示後に `/` へ遷移
   */
  const onSubmit = async (e: React.SubmitEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (isCompletingOAuthReturn()) return
    setMessageKey("account.login.progress")
    setColor("")

    try {
      const body: CreateSessionBody = {
        identifier: handle.trim(),
        password,
        service: publicAuthServer,
      }
      const res = await createSession(body)

      if (res.status !== 200) {
        // サーバーの `error` は表示せず、ステータスから表示言語の文言を選ぶ
        setColor("#b00")
        setMessageKey(errorMessageKeyFromStatus(res.status, "login"))
        return
      }

      clearKnownUnauthenticated()
      setColor("green")
      setMessageKey("account.login.success")
      setTimeout(() => {
        window.location.href = "/"
      }, REDIRECT_DELAY_MS)
    } catch (err) {
      console.error(err)
      setColor("#b00")
      setMessageKey("error.network")
    }
  }

  return (
    <form
      id="login-form"
      className={`${ui["base-card"]} ${styles["form"]}`}
      onSubmit={onSubmit}
    >
      <div className={styles.content}>
        <div className={styles["controls"]}>
          <button
            type="button"
            className={`${ui["base-button"]} ${ui["text-button"]} ${ui["blue-button"]}`}
            disabled={oauthStarting}
            onClick={() => {
              void startOAuth()
            }}
          >
            {t("account.login.oauthSubmit")}
          </button>

          <Collapsible label={t("account.login.passwordToggle")}>
            <div className={styles.password}>
              <div>
                <label htmlFor="username">
                  {t("account.login.handleLabel")}
                </label>
                <div className={ui["base-input-box"]}>
                  <input
                    className={ui["base-input-field"]}
                    id="username"
                    name="username"
                    type="text"
                    autoComplete="username"
                    placeholder="example.bsky.social"
                    required
                    value={handle}
                    onChange={e => setHandle(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label htmlFor="password">
                  {renderSlots(raw("account.login.appPasswordLabel"), {
                    link: (
                      <a href="https://bsky.app/settings/app-passwords">
                        {t("account.login.appPasswordLink")}
                      </a>
                    ),
                  })}
                </label>
                <div className={ui["base-input-box"]}>
                  <input
                    className={ui["base-input-field"]}
                    id="password"
                    name="password"
                    type="password"
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                  />
                </div>
              </div>

              <button
                type="submit"
                className={`${ui["base-button"]} ${ui["text-button"]} ${ui["blue-button"]}`}
              >
                {t("account.login.submit")}
              </button>
            </div>
          </Collapsible>
        </div>

        <div
          id="message"
          aria-live="polite"
          style={{ marginTop: "1rem", color }}
        >
          {messageKey ? (
            t(messageKey)
          ) : (
            // 戻りの住所で水和の前（印が `pending` の間）だけ CSS で出す
            <span className={styles["pending"]}>
              {t("account.login.progress")}
            </span>
          )}
        </div>
      </div>
    </form>
  )
}
export default Component
