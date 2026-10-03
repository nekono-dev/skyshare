import React, { useState } from "react"
import { createSession } from "@/client/openapi/client"
import type { CreateSessionBody } from "@/client/openapi/model/createSessionBody"
import { clearKnownUnauthenticated } from "@/lib/account/activeAccountSession"
import { errorMessageKeyFromStatus } from "@/lib/i18n/errorMessage"
import { useT } from "@/lib/i18n/react"
import { renderSlots } from "@/lib/i18n/rich"
import type { PlainMessageKey } from "@/lib/i18n/translate"
import styles from "./index.module.css"
import ui from "@/styles/ui.module.css"

/**
 * Bluesky ログインフォームコンポーネント。
 *
 * 責務と処理概要:
 * - ハンドルとアプリパスワードを受け取り、セッション作成 API を呼び出す。
 * - 成功/失敗メッセージを表示し、成功時はトップページへ遷移する。
 *
 * 利用上の制約:
 * - 自身が `base-card` のため、別の `base-card` の中に入れ子にしないこと。
 *   入れ子にすると Proton Pass が入力欄を検出できなくなる（検証で確認済み）。
 * - 入力欄には `autoComplete`（username / current-password）と label の `htmlFor` を設定している。
 */

type Props = {
  /** ハンドル欄の初期値。再ログイン導線など、対象アカウントが既知の場合に指定する。 */
  initialHandle?: string
}

/**
 * ログインフォームを描画する。
 *
 * Input:
 * - `initialHandle`: ハンドル欄の初期値（省略時は空欄）
 *
 * Output:
 * - 認証情報入力フォームと状態メッセージ表示を含む JSX
 *
 * 例:
 * - 出力: ハンドル入力・パスワード入力・ログインボタンを持つフォーム
 */
export const Component = ({ initialHandle }: Props = {}) => {
  const { t, raw } = useT()
  const [handle, setHandle] = useState(initialHandle ?? "")
  const [password, setPassword] = useState("")
  // 状態メッセージは文言キーで保持し、表示時に翻訳する（言語切り替えに追従させるため）
  const [messageKey, setMessageKey] = useState<PlainMessageKey | "">("")
  const [color, setColor] = useState("")

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
    setMessageKey("account.login.progress")
    setColor("")

    try {
      const body: CreateSessionBody = {
        identifier: handle.trim(),
        password,
        service: "https://bsky.social",
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
      }, 700)
    } catch (err) {
      console.error(err)
      setColor("#b00")
      setMessageKey("error.network")
    }
  }

  return (
    <form id="login-form" className={ui["base-card"]} onSubmit={onSubmit}>
      <div className={styles.content}>
        <div>
          <label htmlFor="username">{t("account.login.handleLabel")}</label>
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

        <div
          id="message"
          aria-live="polite"
          style={{ marginTop: "1rem", color }}
        >
          {messageKey ? t(messageKey) : ""}
        </div>
      </div>
    </form>
  )
}
export default Component
