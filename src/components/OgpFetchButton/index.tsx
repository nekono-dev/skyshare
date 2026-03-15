import React, { useEffect, useMemo, useState } from "react"
import { RichText } from "@atproto/api"
import { extractUrl } from "@/client/openapi/client"
import type { ExtractUrl200 } from "@/client/openapi/model"
import { extractLinkUrisFromFacets } from "@/lib/richtext"
import ui from "@/styles/ui.module.css"
import styles from "./index.module.css"

type Props = {
  text: string
  onChange: (ogp: ExtractUrl200 | null) => void
}

export const Component: React.FC<Props> = ({ text, onChange }) => {
  const [ogpResult, setOgpResult] = useState<ExtractUrl200 | null>(null)
  const [ogpStatus, setOgpStatus] = useState<string | null>(null)
  const [isOgpLoading, setIsOgpLoading] = useState(false)

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
    setOgpResult(null)
    setOgpStatus(null)
    onChange(null)
  }, [detectedUrl, onChange])

  const handleFetchOgp = async () => {
    if (!detectedUrl || isOgpLoading) return

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
        setOgpResult(null)
        onChange(null)
        return
      }

      setOgpResult(res.data)
      setOgpStatus("OGPを取得しました。")
      onChange(res.data)
    } catch (err) {
      console.error(err)
      setOgpResult(null)
      setOgpStatus("OGP取得中にエラーが発生しました。")
      onChange(null)
    } finally {
      setIsOgpLoading(false)
    }
  }

  if (!detectedUrl) {
    return null
  }

  return (
    <div className={styles.section}>
      <div className={styles.actionRow}>
        <button
          type="button"
          className={`${ui.baseButton} ${ui.textButton} ${ui.whiteButton}`}
          onClick={handleFetchOgp}
          disabled={isOgpLoading}
        >
          {isOgpLoading ? "取得中…" : "OGP取得"}
        </button>
        <span className={styles.detectedUrl}>{detectedUrl}</span>
      </div>

      {ogpStatus && <div className={styles.status}>{ogpStatus}</div>}

      {ogpResult?.image && (
        <div className={styles.previewArea}>
          <img
            src={ogpResult.image}
            alt={ogpResult.title || "検出URLのOGP画像"}
            className={styles.previewImg}
            loading="lazy"
          />
        </div>
      )}
    </div>
  )
}

export default Component
