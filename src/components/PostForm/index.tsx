/**
 * 投稿フォームコンポーネント。
 *
 * 責務と処理概要:
 * - テキスト投稿・画像投稿・OGP 投稿の入力状態を管理する。
 * - 送信時に OpenAPI 契約へ整形し、`createEntry` API を呼び出す。
 * - 画像投稿では不足しうる `imagesMeta` を補完して送信する。
 */
import React, { useEffect, useState } from "react"
import { createEntry } from "@/client/openapi/client"
import type { CreateEntryBody } from "@/client/openapi/model"
import type { CreateEntryBodySelfLabels } from "@/client/openapi/model"
import ImagePicker, { type ImageEntry } from "@/components/ImagePicker"
import ImagePreview from "@/components/ImagePreview"
import LanguageSelect from "@/components/LanguageSelect"
import Loading from "@/components/Loading"
import OgpFetchButton, { type OgpResult } from "@/components/OgpFetchButton"
import SelfLabelsSelect from "@/components/SelfLabelsSelect"
import ToggleSwitch from "@/components/ToggleSwitch"
import {
  readOpenXPopupSetting,
  writeOpenXPopupSetting,
} from "@/lib/shareSettings"
import { canShareWithWebApi, shareWithWebApi } from "@/lib/webShare"
import { buildXIntentText, openXIntentPopup } from "@/lib/xIntent"
import styles from "./index.module.css"
import ui from "@/styles/ui.module.css"

type Props = {
  onClose?: () => void
  avatarUrl?: string | null
}

type ImageSizeCandidate = {
  width?: number
  height?: number
}

/**
 * API エラーコードを表示文言へ変換する。
 *
 * Input:
 * - `errorCode`: API から返却されたエラーコード
 *
 * Output:
 * - ユーザー向け日本語メッセージ
 *
 * 例:
 * - 入力: "APP_BSKY_POST_FAILED"
 * - 出力: "Blueskyへの投稿に失敗しました。"
 */
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

/**
 * ImagePicker が生成した object URL を解放する。
 *
 * Input:
 * - `entry`: プレビュー URL を保持する画像エントリ
 *
 * Output:
 * - なし
 *
 * 例:
 * - 入力: 画像付きの `ImageEntry`
 * - 出力: 関連する object URL を解放
 */
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

/**
 * Blob から画像の自然サイズを読み取る。
 *
 * 処理の趣旨:
 * - ImagePicker 側でサイズ取得に失敗した場合でも、送信直前に API 必須の width/height を補完する。
 *
 * Input:
 * - `blob`: 投稿対象の画像 Blob
 *
 * Output:
 * - `{ width, height }`
 *
 * 例:
 * - 入力: JPEG Blob
 * - 出力: `{ width: 1200, height: 630 }`
 */
const loadBlobImageSize = async (blob: Blob) => {
  const objectUrl = URL.createObjectURL(blob)

  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const nextImage = new Image()
      nextImage.onload = () => resolve(nextImage)
      nextImage.onerror = () =>
        reject(new Error("画像サイズの取得に失敗しました。"))
      nextImage.src = objectUrl
    })

    if (image.naturalWidth < 1 || image.naturalHeight < 1) {
      throw new Error("画像サイズが不正です。")
    }

    return {
      width: image.naturalWidth,
      height: image.naturalHeight,
    }
  } finally {
    URL.revokeObjectURL(objectUrl)
  }
}

/**
 * 画像サイズ候補が API 契約を満たす完全な width/height を持つか判定する。
 *
 * Input:
 * - `value`: ImagePicker が保持している画像サイズ候補
 *
 * Output:
 * - 完全なサイズなら `true`
 *
 * 例:
 * - 入力: `{ width: 800, height: 600 }`
 * - 出力: `true`
 */
const hasValidImageSize = (
  value: ImageSizeCandidate,
): value is { width: number; height: number } => {
  return (
    typeof value?.width === "number" &&
    value.width > 0 &&
    typeof value.height === "number" &&
    value.height > 0
  )
}

/**
 * 画像投稿用の imagesMeta を必ず完全な形で組み立てる。
 *
 * 想定する入力形状:
 * - `entry.originalBlobs` は投稿対象画像の配列
 * - `entry.meta` は ImagePicker が保持する元画像サイズ配列（欠落の可能性あり）
 *
 * 処理の趣旨:
 * - 既存メタデータが完全ならそれを利用する。
 * - 欠落がある場合は Blob から再読込して API 契約を満たす。
 *
 * Input:
 * - `entry`: 投稿対象の画像エントリ
 *
 * Output:
 * - API に送信できる `imagesMeta`
 *
 * 例:
 * - 入力: meta が完全な `ImageEntry`
 * - 出力: 既存 meta をそのまま返す
 */
const resolveImageMetadata = async (
  entry: ImageEntry,
): Promise<NonNullable<CreateEntryBody["imagesMeta"]>> => {
  const imageSizes = entry.meta ?? []
  const hasCompleteImageSizes =
    imageSizes.length === entry.originalBlobs.length &&
    imageSizes.every(hasValidImageSize)

  if (hasCompleteImageSizes) {
    return imageSizes.map(value => ({
      width: value.width,
      height: value.height,
    }))
  }

  return Promise.all(entry.originalBlobs.map(loadBlobImageSize))
}

/**
 * 投稿フォーム本体を描画する。
 *
 * Input:
 * - `onClose`: フォームクローズ時コールバック
 * - `avatarUrl`: 表示用アバター URL
 *
 * Output:
 * - 投稿入力 UI 一式
 *
 * 例:
 * - 入力: `{ avatarUrl: "https://..." }`
 * - 出力: テキスト・画像・OGP を扱える投稿フォーム
 */
export const Component: React.FC<Props> = ({ onClose, avatarUrl }) => {
  const [text, setText] = useState("")
  const [languageCode, setLanguageCode] = useState("ja")
  const [openXPopup, setOpenXPopup] = useState(() =>
    readOpenXPopupSetting(false),
  )
  const [selfLabel, setSelfLabel] = useState<
    CreateEntryBodySelfLabels | undefined
  >(undefined)
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

  /**
   * 投稿フォームの内容を API 契約に合わせて送信する。
   *
   * Input:
   * - `e`: フォーム送信イベント
   *
   * Output:
   * - なし
   *
   * 例:
   * - 入力: テキストと画像付きフォーム送信
   * - 出力: createEntry を呼び出し、成功時は状態を初期化
   */
  const handleSubmit = async (e: React.SubmitEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (isSubmitting) return

    setIsSubmitting(true)
    setStatus("送信中…")
    setStatusColor(undefined)

    try {
      const payload: CreateEntryBody = {
        text,
        langs: [languageCode],
        selfLabels: selfLabel,
      }

      if (imageEntry) {
        payload.ogImage = imageEntry.thumbnailBlob
        payload.images = imageEntry.originalBlobs
        payload.imagesMeta = await resolveImageMetadata(imageEntry)
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
      const shareText = buildXIntentText(text, res.data.skyshare.uri)

      // 「Xをポップアップで開く」が有効なら常に intent を使い、無効時のみ WebShareAPI を試行する。
      if (openXPopup) {
        const popupOpened = openXIntentPopup(shareText)
        setStatus(
          popupOpened
            ? `投稿に成功しました。`
            : `投稿に成功しました。x.com 投稿画面を開けませんでした。ポップアップブロックを確認してください。`,
        )
      } else if (canShareWithWebApi()) {
        const shareResult = await shareWithWebApi({ text: shareText })
        if (shareResult.ok) {
          setStatus(`投稿に成功しました。`)
        } else if (shareResult.reason === "aborted") {
          setStatus(`投稿に成功しました。共有はキャンセルされました。`)
        } else {
          setStatus(`投稿に成功しました。WebShareAPI での共有に失敗しました。`)
        }
      } else {
        const popupOpened = openXIntentPopup(shareText)
        setStatus(
          popupOpened
            ? `投稿に成功しました。WebShareAPI 非対応のため x.com 投稿画面を開きました。`
            : `投稿に成功しました。x.com 投稿画面を開けませんでした。ポップアップブロックを確認してください。`,
        )
      }

      setText("")
      // 生成済みプレビューURLを解放してリークを防ぐ。
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
        <div className={styles.toolbar}>
          <div className={styles.labelSelect}>
            <SelfLabelsSelect
              value={selfLabel}
              onChange={setSelfLabel}
              disabled={isSubmitting}
            />
          </div>
          <LanguageSelect
            value={languageCode}
            onChange={setLanguageCode}
            className={styles.langSelect}
            disabled={isSubmitting}
          />
        </div>

        <div className={styles.toolbar}>
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
          <div className={styles.rightInfo}>
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
        <ToggleSwitch
          checked={openXPopup}
          disabled={isSubmitting}
          label="Xをポップアップで開く"
          onCheckedChange={next => {
            setOpenXPopup(next)
            writeOpenXPopupSetting(next)
          }}
        />
        <ImagePreview value={imageEntry} />
      </form>
    </div>
  )
}

export default Component
