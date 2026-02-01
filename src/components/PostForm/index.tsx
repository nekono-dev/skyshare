import React, { useState } from "react"
import { entry } from "@/client/openapi/client"
import styles from "./index.module.css"

export const Component = () => {
  const [title, setTitle] = useState("")
  const [text, setText] = useState("")
  const [status, setStatus] = useState<string | null>(null)
  const [statusColor, setStatusColor] = useState<string | undefined>(undefined)

  const handleSubmit = async (e: React.SubmitEvent<HTMLFormElement>) => {
    e.preventDefault()
    setStatus("送信中…")
    setStatusColor(undefined)

    try {
      const res = await entry({ text })
      if (res.status !== 200) {
        setStatusColor("#b00")
        // @ts-ignore
        setStatus(res.data?.error || "投稿に失敗しました。")
        return
      }

      setStatusColor("green")
      // @ts-ignore
      const uri = res.data?.uri || ""
      setStatus(`投稿に成功しました。URI: https://bsky.social/profile/${uri}`)
      setTitle("")
      setText("")
    } catch (err) {
      console.error(err)
      setStatusColor("#b00")
      setStatus("サーバへ接続できませんでした。")
    }
  }

  return (
    <form id="entry-form" onSubmit={handleSubmit}>
      <label>
        タイトル
        <input
          className={styles.input}
          id="title"
          name="title"
          placeholder="タイトル（入力NG）"
          value={title}
          onChange={e => setTitle(e.target.value)}
        />
      </label>

      <label>
        本文
        <textarea
          className={styles.textarea}
          id="text"
          name="text"
          rows={6}
          placeholder="本文を入力"
          value={text}
          onChange={e => setText(e.target.value)}
        />
      </label>

      <button type="submit" className={styles.button}>
        投稿
      </button>

      <div
        id="status"
        aria-live="polite"
        style={{ marginTop: "0.75rem", color: statusColor }}
      >
        {status}
      </div>
    </form>
  )
}
export default Component
