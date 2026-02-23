import React, { useState } from "react"
import { createEntry } from "@/client/openapi/client"
import styles from "./index.module.css"
import PrivacyDialog from "../PrivacyDialog"
import ui from "@/styles/ui.module.css"

import pic from "@/images/image.svg"

export const Component = () => {
  const [text, setText] = useState("")
  const [status, setStatus] = useState<string | null>(null)
  const [statusColor, setStatusColor] = useState<string | undefined>(undefined)

  const maxLen = 300
  const [privacyOpen, setPrivacyOpen] = useState(false)
  const [privacyMode, setPrivacyMode] = useState<"any" | "none">("any")
  const [allowFollower, setAllowFollower] = useState(false)
  const [allowFollowing, setAllowFollowing] = useState(false)
  const [allowMentioned, setAllowMentioned] = useState(false)

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setStatus("送信中…")
    setStatusColor(undefined)

    try {
      const res = await createEntry({ text })
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
      setText("")
    } catch (err) {
      console.error(err)
      setStatusColor("#b00")
      setStatus("サーバへ接続できませんでした。")
    }
  }

  return (
    <div className={styles.modal} role="dialog" aria-label="投稿フォーム">
      <div className={styles.header}>
        <button
          className={`${ui.baseButton} ${ui.textButton} ${ui.whiteButton}`}
          aria-label="キャンセル"
        >
          キャンセル
        </button>
        <div className={styles.headerRight}>
          <button
            className={`${ui.baseButton} ${ui.textButton} ${ui.whiteButton}`}
          >
            下書き
          </button>
          <button
            form="entry-form"
            className={`${ui.baseButton} ${ui.textButton} ${ui.blueButton}`}
            type="submit"
          >
            投稿
          </button>
        </div>
      </div>

      <form id="entry-form" className={styles.form} onSubmit={handleSubmit}>
        <div className={styles.bodyRow}>
          <div className={styles.avatar} aria-hidden>
            <svg viewBox="0 0 36 36" className={styles.avatarSvg}>
              <circle cx="18" cy="18" r="18" fill="#e6eef9" />
              <text
                x="50%"
                y="55%"
                textAnchor="middle"
                fontSize="14"
                fill="#2b6cb0"
              >
                ネコ
              </text>
            </svg>
          </div>

          <div className={styles.inputArea}>
            <textarea
              className={styles.textarea}
              id="text"
              name="text"
              rows={6}
              placeholder="最近どう？"
              value={text}
              onChange={e => setText(e.target.value)}
              maxLength={maxLen}
            />
          </div>
        </div>

        <div className={styles.privacyRow}>
          <button
            className={styles.privacyPill}
            type="button"
            onClick={() => setPrivacyOpen(open => !open)}
            aria-expanded={privacyOpen}
          >
            {privacyMode === "any" ? "誰でも反応可能 ▾" : "返信不可 ▾"}
          </button>

          <PrivacyDialog
            open={privacyOpen}
            onClose={() => setPrivacyOpen(false)}
            mode={privacyMode}
            setMode={setPrivacyMode}
            allowFollower={allowFollower}
            setAllowFollower={setAllowFollower}
            allowFollowing={allowFollowing}
            setAllowFollowing={setAllowFollowing}
            allowMentioned={allowMentioned}
            setAllowMentioned={setAllowMentioned}
          />
        </div>

        <div className={styles.toolbar}>
          <div className={styles.leftIcons}>
            <button
              className={`${ui.baseButton} ${ui.whiteButton} ${ui.nontextButton} ${ui.mdButton}`}
              type="button"
              aria-label="画像追加"
            >
              <img src={pic.src} width={18} height={18} />
            </button>
          </div>

          <div className={styles.rightInfo}>
            <span className={styles.lang}>日本語</span>
            <span className={styles.charCount}>
              {text.length}/{maxLen}
            </span>
          </div>
        </div>

        <div
          id="status"
          aria-live="polite"
          className={styles.status}
          style={{ color: statusColor }}
        >
          {status}
        </div>
      </form>
    </div>
  )
}
export default Component
