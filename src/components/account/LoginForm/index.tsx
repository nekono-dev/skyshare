import React, { useState } from "react"
import { createSession, startSessionAuthorization } from "@/client/openapi/client"
import TabButtons, { panelId, tabId } from "@/components/common/TabButtons"
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
 * - OAuth（初期）とアプリパスワードのログインを、タブで切り替える。選んだタブの中身だけを描画する。
 * - OAuth のタブはユーザー名の入力欄を持たず、ボタンでログインの開始 API を呼び、返った認可の画面
 *   （Bluesky の画面。ハンドルとパスワードはそこで入力する）へ遷移する。戻りの完了は
 *   `LoginAuthorizationReturn` が受け持つ。
 * - アプリパスワードのタブは、ハンドルとアプリパスワードを受け取り、セッション作成 API を呼び出す。
 *   成功/失敗メッセージを表示し、成功時はトップページへ遷移する。
 *
 * 利用上の制約:
 * - 自身が `base-card` のため、別の `base-card` の中に入れ子にしないこと。
 *   入れ子にすると Proton Pass が入力欄を検出できなくなる（検証で確認済み）。
 *   タブもこのフォームの中に置き、フォーム自体がカードという構造を保つ。
 * - 入力欄には `autoComplete`（username / current-password）と label の `htmlFor` を設定している。
 */

type Props = {
  /**
   * ハンドルの初期値。再ログイン導線など、対象アカウントが既知の場合に指定する。
   * アプリパスワードのタブのハンドル欄と、OAuth の開始の入力済みの指定（`loginHint`）に使う。
   */
  initialHandle?: string
}

type LoginTab = "oauth" | "password"

const TAB_ID_PREFIX = "login-method"

/**
 * ログインフォームを描画する。
 *
 * Input:
 * - `initialHandle`: ハンドルの初期値（省略時は空欄・入力済みの指定なし）
 *
 * Output:
 * - ログインの方法のタブと、選んだ方法の入力（OAuth はボタンだけ）と状態メッセージ表示を含む JSX
 *
 * 例:
 * - 出力: 初期は「Bluesky でログイン」のボタン。アプリパスワードのタブでハンドル入力・パスワード入力・ログインボタン
 */
export const Component = ({ initialHandle }: Props = {}) => {
  const { t, raw } = useT()
  const [handle, setHandle] = useState(initialHandle ?? "")
  const [password, setPassword] = useState("")
  // 状態メッセージは文言キーで保持し、表示時に翻訳する（言語切り替えに追従させるため）
  const [messageKey, setMessageKey] = useState<PlainMessageKey | "">("")
  const [color, setColor] = useState("")
  const [tab, setTab] = useState<LoginTab>("oauth")
  const [oauthStarting, setOauthStarting] = useState(false)

  /**
   * タブを切り替える。前のタブの状態メッセージは持ち越さない。
   */
  const changeTab = (next: LoginTab) => {
    setTab(next)
    setMessageKey("")
    setColor("")
  }

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
    if (oauthStarting) return
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
      <TabButtons
        idPrefix={TAB_ID_PREFIX}
        ariaLabel={t("account.login.tabsAria")}
        items={[
          { key: "oauth", label: t("account.login.tabOAuth") },
          { key: "password", label: t("account.login.tabPassword") },
        ]}
        value={tab}
        onChange={changeTab}
      />
      <div
        className={styles.content}
        role="tabpanel"
        id={panelId(TAB_ID_PREFIX, tab)}
        aria-labelledby={tabId(TAB_ID_PREFIX, tab)}
      >
        {tab === "oauth" ? (
          <>
            <p className={ui.text}>{t("account.login.oauthHint")}</p>
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
          </>
        ) : (
          <>
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
          </>
        )}

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
