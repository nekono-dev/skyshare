import React, { useState } from "react"
import { createSession } from "@/client/openapi/client"
import type { CreateSessionBody } from "@/client/openapi/model/createSessionBody"
import styles from "./index.module.css"

export const Component = () => {
  const [handle, setHandle] = useState("")
  const [password, setPassword] = useState("")
  const [service, setService] = useState("https://bsky.social")
  const [message, setMessage] = useState("")
  const [color, setColor] = useState("")

  const onSubmit = async (e: React.SubmitEvent<HTMLFormElement>) => {
    e.preventDefault()
    setMessage("ログイン中…")
    setColor("")

    try {
      const body: CreateSessionBody = {
        identifier: handle.trim(),
        password,
        service: service.trim() || "https://bsky.social",
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
    <form id="login-form" onSubmit={onSubmit}>
      <div>
        ハンドル (handle or email)
        <input
          className={styles.input}
          id="handle"
          name="handle"
          placeholder="alice.example.com or alice@mail.com"
          required
          value={handle}
          onChange={e => setHandle(e.target.value)}
        />
      </div>

      <div>
        パスワード
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

      <div>
        サービス URL
        <input
          className={styles.input}
          id="service"
          name="service"
          value={service}
          onChange={e => setService(e.target.value)}
        />
      </div>

      <button type="submit" className={styles.button}>
        ログイン
      </button>

      <p id="message" aria-live="polite" style={{ marginTop: "1rem", color }}>
        {message}
      </p>
    </form>
  )
}
export default Component
