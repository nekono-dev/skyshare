import React, { useEffect, useMemo, useState } from "react"
import { RichText } from "@atproto/api"
import { extractUrl } from "@/client/openapi/client"
import type { ExtractUrl200 } from "@/client/openapi/model"
import { extractLinkUrisFromFacets } from "@/lib/richtext"
import { createOgpThumbnailFromBlob } from "@/lib/postImageProcessing"
import ui from "@/styles/ui.module.css"
import styles from "./index.module.css"

/**
 * 投稿文から URL を検出して OGP 情報を取得するコンポーネント。
 *
 * 責務と処理概要:
 * - テキストから URL を抽出し、OGP 取得 API を呼び出す。
 * - 取得画像を OGP サムネイル仕様へ変換して `onChange` で返す。
 * - 失敗時は状態メッセージを表示し、親の OGP 状態をクリアする。
 */

type OgpMeta = {
  title: string
  description: string
}

export type OgpResult = {
  meta: OgpMeta
  imageBlob: Blob
  sourceUrl: string
}

type Props = {
  text: string
  value: OgpResult | null
  onChange: (ogp: OgpResult | null) => void
  disabled?: boolean
}

/**
 * OGP 応答が画像 URL を含む型か判定する型ガード。
 *
 * Input:
 * - `value`: extractUrl API の 200 応答
 *
 * Output:
 * - `image: string` を持つ場合 `true`
 *
 * 例:
 * - 入力: `{ title: "x", description: "y", image: "https://..." }`
 * - 出力: `true`
 */
const isOgpWithImage = (
  value: ExtractUrl200,
): value is ExtractUrl200 & { image: string } => {
  return typeof (value as { image?: unknown }).image === "string"
}

/**
 * OGP 取得 UI を描画する。
 *
 * Input:
 * - `text`: 投稿本文
 * - `value`: 現在の OGP 結果
 * - `onChange`: OGP 結果更新通知
 * - `disabled`: 操作可否
 *
 * Output:
 * - URL 検出時の取得ボタン、ステータス、画像プレビュー
 */
export const Component: React.FC<Props> = ({
  text,
  value,
  onChange,
  disabled = false,
}) => {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [ogpStatus, setOgpStatus] = useState<string | null>(null)
  const [isOgpLoading, setIsOgpLoading] = useState(false)
  const [lastFetchedUrl, setLastFetchedUrl] = useState<string | null>(null)

  /**
   * 本文から OGP 対象 URL を抽出する。
   *
   * 処理の趣旨:
   * - まず `RichText` の facet 検出を優先し、失敗時は正規表現フォールバックで URL を拾う。
   */
  const detectedUrl = useMemo(() => {
    if (!text.trim()) return null

    try {
      const rt = new RichText({ text })
      rt.detectFacetsWithoutResolution()
      const uris = extractLinkUrisFromFacets(rt.facets)
      if (uris.length > 0) {
        return uris[0]
      }
    } catch (err) {
      console.warn("Failed to detect URL with RichText", err)
    }

    const fallback = text.match(/https?:\/\/[^\s]+/i)
    return fallback ? fallback[0] : null
  }, [text])

  useEffect(() => {
    if (!value) {
      if (previewUrl) {
        try {
          URL.revokeObjectURL(previewUrl)
        } catch (error) {}
      }
      setPreviewUrl(null)
      return
    }

    const nextPreviewUrl = URL.createObjectURL(value.imageBlob)
    if (previewUrl) {
      try {
        URL.revokeObjectURL(previewUrl)
      } catch (error) {}
    }
    setPreviewUrl(nextPreviewUrl)
    // 親の状態と同期してプレビューURLを管理する
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])

  useEffect(() => {
    return () => {
      if (!previewUrl) return
      try {
        URL.revokeObjectURL(previewUrl)
      } catch (error) {}
    }
  }, [previewUrl])

  /**
   * 検出 URL から OGP 情報を取得して親へ反映する。
   *
   * 失敗時の方針:
   * - ステップごとに失敗メッセージを更新し、`onChange(null)` で不整合な OGP 状態を残さない。
   *
   * Output:
   * - 返り値なし（state 更新と `onChange` 通知）
   */
  const handleFetchOgp = async () => {
    if (!detectedUrl || isOgpLoading || disabled) return

    setIsOgpLoading(true)
    setOgpStatus("OGPを取得中…")

    try {
      const res = await extractUrl({ url: detectedUrl })
      if (res.status !== 200) {
        const errorMessage =
          "error" in res.data && typeof res.data.error === "string"
            ? res.data.error
            : "OGP取得に失敗しました。"
        setOgpStatus(errorMessage)
        onChange(null)
        return
      }

      if (!isOgpWithImage(res.data) || !res.data.image) {
        setOgpStatus("OGP画像が見つかりませんでした。")
        onChange(null)
        return
      }

      const imageRes = await fetch(res.data.image)
      if (!imageRes.ok) {
        setOgpStatus("OGP画像の取得に失敗しました。")
        onChange(null)
        return
      }

      const rawBlob = await imageRes.blob()
      if (!rawBlob.type.startsWith("image/")) {
        setOgpStatus("OGP画像の形式が不正です。")
        onChange(null)
        return
      }

      let imageBlob: Blob
      try {
        imageBlob = await createOgpThumbnailFromBlob(rawBlob)
      } catch {
        setOgpStatus("OGP画像の変換に失敗しました。")
        onChange(null)
        return
      }

      const nextResult: OgpResult = {
        meta: {
          title: res.data.title,
          description: res.data.description,
        },
        imageBlob,
        sourceUrl: detectedUrl,
      }

      setLastFetchedUrl(detectedUrl)
      setOgpStatus("OGPを取得しました。")
      onChange(nextResult)
    } catch (err) {
      console.error(err)
      setOgpStatus("OGP取得中にエラーが発生しました。")
      onChange(null)
    } finally {
      setIsOgpLoading(false)
    }
  }

  if (!detectedUrl && !value && !ogpStatus) {
    return null
  }

  return (
    <div className={styles.section}>
      {detectedUrl && (
        <div className={styles.actionRow}>
          <button
            type="button"
            className={`${ui.baseButton} ${ui.textButton} ${ui.whiteButton}`}
            onClick={handleFetchOgp}
            disabled={isOgpLoading || disabled}
          >
            {isOgpLoading ? "取得中…" : "OGP取得"}
          </button>
          <span className={styles.detectedUrl}>{detectedUrl}</span>
        </div>
      )}

      {ogpStatus && <div className={styles.status}>{ogpStatus}</div>}

      {previewUrl && (
        <div className={styles.previewArea}>
          <img
            src={previewUrl}
            alt={value?.meta.title || "検出URLのOGP画像"}
            className={styles.previewImg}
            loading="lazy"
          />
        </div>
      )}
    </div>
  )
}

export default Component
