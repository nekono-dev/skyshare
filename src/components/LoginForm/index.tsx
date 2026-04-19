import React, { useState } from "react"
import { createSession } from "@/client/openapi/client"
import type { CreateSessionBody } from "@/client/openapi/model/createSessionBody"
import styles from "./index.module.css"
import ui from "@/styles/ui.module.css"

/**
 * Bluesky ログインフォームコンポーネント。
 *
 * 責務と処理概要:
 * - ハンドルとアプリパスワードを受け取り、セッション作成 API を呼び出す。
 * - 成功/失敗メッセージを表示し、成功時はトップページへ遷移する。
 */

/**
 * ログインフォームを描画する。
 *
 * Output:
 * - 認証情報入力フォームと状態メッセージ表示を含む JSX
 *
 * 例:
 * - 出力: ハンドル入力・パスワード入力・ログインボタンを持つフォーム
 */
export const Component = () => {
  const [handle, setHandle] = useState("")
  const [password, setPassword] = useState("")
  // const [service, setService] = useState("https://bsky.social")
  const [message, setMessage] = useState("")
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
    setMessage("ログイン中…")
    setColor("")

    try {
      const body: CreateSessionBody = {
        identifier: handle.trim(),
        password,
        service: "https://bsky.social",
        // service: service.trim() || "https://bsky.social",
      }
      const res = await createSession(body)

      if (res.status !== 200) {
        const err = res.data.error || "ログインに失敗しました。"
        setColor("#b00")
        setMessage(err)
        return
      }

      setColor("green")
      setMessage("ログイン成功。リダイレクトします…")
      setTimeout(() => {
        window.location.href = "/"
      }, 700)
    } catch (err) {
      console.error(err)
      setColor("#b00")
      setMessage("サーバへ接続できませんでした。")
    }
  }

  return (
    <form id="login-form" className={ui.baseCard} onSubmit={onSubmit}>
      <div className={styles.content}>
        <div>
          <label>ハンドル (@以降のhandle)</label>
          <input
            className={styles.input}
            id="handle"
            name="handle"
            placeholder="example.bsky.social"
            required
            value={handle}
            onChange={e => setHandle(e.target.value)}
          />
        </div>

        <div>
          <label>
            アプリパスワード（
            <a href="https://bsky.app/settings/app-passwords">作成ページ</a>）
          </label>
          <input
            className={styles.input}
            id="password"
            name="password"
            type="password"
            required
            value={password}
            onChange={e => setPassword(e.target.value)}
          />
        </div>

        <button
          type="submit"
          className={`${ui.baseButton} ${ui.textButton} ${ui.blueButton}`}
        >
          ログイン
        </button>

        <p id="message" aria-live="polite" style={{ marginTop: "1rem", color }}>
          {message}
        </p>
      </div>
    </form>
  )
}
export default Component
