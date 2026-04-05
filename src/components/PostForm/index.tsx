import React, { useEffect, useState } from "react"
import { createEntry } from "@/client/openapi/client"
import ImagePicker, { type ImageEntry } from "@/components/ImagePicker"
import LanguageSelect from "@/components/LanguageSelect"
import Loading from "@/components/Loading"
import OgpFetchButton, { type OgpResult } from "@/components/OgpFetchButton"
import styles from "./index.module.css"
import ui from "@/styles/ui.module.css"

type Props = {
  onClose?: () => void
  avatarUrl?: string | null
}

const resolveEntryErrorMessage = (errorCode: string) => {
  switch (errorCode) {
    case "APP_BSKY_POST_FAILED":
      return "Blueskyへの投稿に失敗しました。"
    case "SKYSHARE_ENTRY_CREATE_FAILED":
      return "Blueskyへの投稿は成功しましたが、SkyShareレコード作成に失敗しました。"
    case "ENTRY_CREATE_UNEXPECTED_ERROR":
      return "投稿処理中に予期せぬエラーが発生しました。"
    default:
      return errorCode
  }
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
  const [ogpResult, setOgpResult] = useState<OgpResult | null>(null)
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
      const payload: {
        text: string
        langs: string[]
        ogMeta?: { title: string; description: string }
        ogImage?: Blob
        images?: Blob[]
        imagesMeta?: string
      } = {
        text,
        langs: [languageCode],
      }

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

      if (imageEntry) {
        payload.ogImage = imageEntry.thumbnailBlob
        payload.images = imageEntry.originalBlobs
        if (hasCompleteImageSizes) {
          payload.imagesMeta = JSON.stringify(
            imageSizes.map(v => ({
              width: v.width,
              height: v.height,
            })),
          )
        }
      } else if (ogpResult) {
        payload.ogMeta = ogpResult.meta
        payload.ogImage = ogpResult.imageBlob
      }

      const res = await createEntry(payload)
      if (res.status !== 200) {
        setStatusColor("#b00")
        const errorCode =
          "error" in res.data && typeof res.data.error === "string"
            ? res.data.error
            : "投稿に失敗しました。"
        setStatus(resolveEntryErrorMessage(errorCode))
        return
      }

      setStatusColor("green")
      setStatus(`投稿に成功しました。SkyShare URL: ${res.data.skyshare.uri}`)
      setText("")
      // revoke created previews
      revokeImageEntry(imageEntry)
      setImageEntry(null)
      setOgpResult(null)
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
        <OgpFetchButton
          text={text}
          value={ogpResult}
          onChange={nextOgp => {
            if (nextOgp) {
              setImageEntry(prevImageEntry => {
                revokeImageEntry(prevImageEntry)
                return null
              })
            }
            setOgpResult(nextOgp)
          }}
          disabled={isSubmitting}
        />
        <ImagePicker
          value={imageEntry}
          onChange={entry => {
            if (entry && ogpResult) {
              setOgpResult(null)
            }
            setImageEntry(entry)
          }}
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
