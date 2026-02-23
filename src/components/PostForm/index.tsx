import React, { useState, useRef } from "react"
import { createEntry } from "@/client/openapi/client"
import LanguageSelect from "@/components/LanguageSelect"
import styles from "./index.module.css"
import ui from "@/styles/ui.module.css"

import pic from "@/images/image.svg"

type Props = {
  onClose?: () => void
  avatarUrl?: string | null
}

export const Component: React.FC<Props> = ({ onClose, avatarUrl }) => {
  const [text, setText] = useState("")
  const [languageCode, setLanguageCode] = useState("ja")
  const [status, setStatus] = useState<string | null>(null)
  const [statusColor, setStatusColor] = useState<string | undefined>(undefined)
  const [files, setFiles] = useState<Array<{ file: File; preview: string }>>([])
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const maxLen = 300

  const handleSubmit = async (e: React.SubmitEvent<HTMLFormElement>) => {
    e.preventDefault()
    setStatus("送信中…")
    setStatusColor(undefined)

    try {
      const res = await createEntry({
        text,
        langs: [languageCode],
      })
      if (res.status !== 200) {
        setStatusColor("#b00")
        // @ts-ignore
        setStatus(res.data.error || "投稿に失敗しました。")
        return
      }

      setStatusColor("green")
      // @ts-ignore
      const url = res.data.bsky.url
      setStatus(`投稿に成功しました。URL: ${url}`)
      setText("")
    } catch (err) {
      console.error(err)
      setStatusColor("#b00")
      setStatus("サーバへ接続できませんでした。")
    }
  }

  return (
    <div
      className={`${ui.baseCard} ${styles.modal}`}
      role="dialog"
      aria-label="投稿フォーム"
    >
      <div className={styles.header}>
        <button
          className={`${ui.baseButton} ${ui.textButton} ${ui.whiteButton}`}
          aria-label="キャンセル"
          onClick={() => {
            if (onClose) onClose()
          }}
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
            {avatarUrl ? (
              <img src={avatarUrl} className={styles.avatarImg} alt="avatar" />
            ) : (
              <svg viewBox="0 0 36 36" className={styles.avatarImg}>
                <circle cx="18" cy="18" r="18" fill="#e6eef9" />
                <text
                  x="50%"
                  y="55%"
                  textAnchor="middle"
                  fontSize="14"
                  fill="#2b6cb0"
                ></text>
              </svg>
            )}
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

        <div className={styles.toolbar}>
          <div className={styles.leftIcons}>
            <button
              className={`${ui.baseButton} ${ui.whiteButton} ${ui.nontextButton} ${ui.mdButton}`}
              type="button"
              aria-label="画像追加"
              onClick={() => fileInputRef.current?.click()}
            >
              <img src={pic.src} width={18} height={18} />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              style={{ display: "none" }}
              onChange={e => {
                const list = e.target.files
                if (!list) return
                const added = Array.from(list).map(f => ({
                  file: f,
                  preview: URL.createObjectURL(f),
                }))
                setFiles(prev => [...prev, ...added])
                // reset input so same file can be selected again if needed
                e.currentTarget.value = ""
              }}
            />
          </div>

          <div className={styles.rightInfo}>
            <LanguageSelect
              value={languageCode}
              onChange={setLanguageCode}
              className={styles.langSelect}
            />
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
        {files.length > 0 && (
          <div className={styles.previewArea}>
            {files.map((fObj, i) => (
              <div key={i} className={styles.previewItem}>
                <img
                  src={fObj.preview}
                  alt={fObj.file.name}
                  className={styles.previewImg}
                />
                <button
                  type="button"
                  className={`${ui.baseButton} ${ui.textButton} ${ui.whiteButton}`}
                  onClick={() => {
                    // revoke URL and remove
                    try {
                      URL.revokeObjectURL(fObj.preview)
                    } catch (e) {}
                    setFiles(prev => prev.filter((_, idx) => idx !== i))
                  }}
                >
                  削除
                </button>
              </div>
            ))}
          </div>
        )}
      </form>
    </div>
  )
}

export default Component
