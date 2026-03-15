import React, { useEffect, useState } from "react"
import { createEntry } from "@/client/openapi/client"
import type { ExtractUrl200 } from "@/client/openapi/model"
import ImagePicker, { type ImageEntry } from "@/components/ImagePicker"
import LanguageSelect from "@/components/LanguageSelect"
import Loading from "@/components/Loading"
import OgpFetchButton from "@/components/OgpFetchButton"
import styles from "./index.module.css"
import ui from "@/styles/ui.module.css"

type Props = {
  onClose?: () => void
  avatarUrl?: string | null
}

const revokeImageEntry = (entry: ImageEntry | null) => {
  if (!entry) return

  try {
    entry.originalPreviews?.forEach(p => {
      try {
        URL.revokeObjectURL(p)
      } catch (e) {}
    })
    try {
      URL.revokeObjectURL(entry.thumbnailPreview)
    } catch (e) {}
  } catch (error) {
    console.warn("Failed to revoke object URL", error)
  }
}

export const Component: React.FC<Props> = ({ onClose, avatarUrl }) => {
  const [text, setText] = useState("")
  const [languageCode, setLanguageCode] = useState("ja")
  const [status, setStatus] = useState<string | null>(null)
  const [statusColor, setStatusColor] = useState<string | undefined>(undefined)
  const [imageEntry, setImageEntry] = useState<ImageEntry | null>(null)
  const [ogpResult, setOgpResult] = useState<ExtractUrl200 | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const maxLen = 300

  useEffect(() => {
    return () => {
      revokeImageEntry(imageEntry)
    }
  }, [imageEntry])

  const handleSubmit = async (e: React.SubmitEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (isSubmitting) return

    setIsSubmitting(true)
    setStatus("送信中…")
    setStatusColor(undefined)

    try {
      const imageSizes = imageEntry?.meta ?? []
      const hasCompleteImageSizes =
        imageEntry !== null &&
        imageSizes.length === imageEntry.originalBlobs.length &&
        imageSizes.every(
          v =>
            typeof v.width === "number" &&
            v.width > 0 &&
            typeof v.height === "number" &&
            v.height > 0,
        )

      const res = await createEntry({
        text,
        langs: [languageCode],
        ogObj: ogpResult || undefined,
        ...(imageEntry
          ? {
              visual: imageEntry.thumbnailBlob,
              images: imageEntry.originalBlobs,
              ...(hasCompleteImageSizes
                ? {
                    imagesMeta: JSON.stringify(
                      imageSizes.map(v => ({
                        width: v.width,
                        height: v.height,
                      })),
                    ),
                  }
                : {}),
            }
          : {}),
      })
      if (res.status !== 200) {
        setStatusColor("#b00")
        const errorMessage =
          "error" in res.data && typeof res.data.error === "string"
            ? res.data.error
            : "投稿に失敗しました。"
        setStatus(errorMessage)
        return
      }

      setStatusColor("green")
      const url = res.data.bsky.url
      setStatus(`投稿に成功しました。URL: ${url}`)
      setText("")
      // revoke created previews
      revokeImageEntry(imageEntry)
      setImageEntry(null)
    } catch (err) {
      console.error(err)
      setStatusColor("#b00")
      setStatus("サーバへ接続できませんでした。")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div
      className={`${ui.baseCard} ${styles.modal}`}
      role="dialog"
      aria-label="投稿フォーム"
    >
      {isSubmitting && <Loading overlay message="投稿中..." />}
      <div className={styles.header}>
        <button
          className={`${ui.baseButton} ${ui.textButton} ${ui.whiteButton}`}
          aria-label="キャンセル"
          disabled={isSubmitting}
          onClick={() => {
            if (onClose) onClose()
          }}
        >
          キャンセル
        </button>
        <div className={styles.headerRight}>
          <button
            className={`${ui.baseButton} ${ui.textButton} ${ui.whiteButton}`}
            disabled={isSubmitting}
          >
            下書き
          </button>
          <button
            form="entry-form"
            className={`${ui.baseButton} ${ui.textButton} ${ui.blueButton}`}
            type="submit"
            disabled={isSubmitting}
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
              disabled={isSubmitting}
            />
          </div>
        </div>
        <OgpFetchButton text={text} onChange={setOgpResult} />
        <ImagePicker
          value={imageEntry}
          onChange={setImageEntry}
          disabled={isSubmitting}
        />

        <div className={styles.toolbar}>
          <div className={styles.rightInfo}>
            <LanguageSelect
              value={languageCode}
              onChange={setLanguageCode}
              className={styles.langSelect}
              disabled={isSubmitting}
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
      </form>
    </div>
  )
}

export default Component
