import React, { useEffect, useMemo, useState } from "react"
import { RichText } from "@atproto/api"
import { extractUrl } from "@/client/openapi/client"
import type { ExtractUrl200 } from "@/client/openapi/model"
import { extractLinkUrisFromFacets } from "@/lib/richtext"
import { createOgpThumbnailFromBlob } from "@/lib/postImageProcessing"
import ui from "@/styles/ui.module.css"

/**
 * 投稿文から URL を検出して OGP 情報を取得するコンポーネント群。
 *
 * 責務と処理概要:
 * - `useOgpFetch` がテキストからの URL 検出・OGP 取得・状態管理を担う。
 * - `OgpFetchButton` は取得操作ボタンのみを描画する。
 * - プレビュー表示は `@/components/OgpPreview` に分離しており、`useOgpFetch` の戻り値を渡して利用する。
 * - レイアウトの自由度を確保するため、呼び出し側が任意の位置にボタンとプレビューを配置できるよう分離している。
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

type UseOgpFetchProps = {
  text: string
  value: OgpResult | null
  onChange: (ogp: OgpResult | null) => void
  disabled?: boolean
}

/**
 * OgpFetchButtonで取得した情報をPreviewに送信するための型
 */
export type UseOgpFetchResult = {
  detectedUrl: string | null
  isOgpLoading: boolean
  ogpStatus: string | null
  previewUrl: string | null
  title?: string
  handleFetchOgp: () => void
  clearOgpStatus: () => void
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
 * 投稿文から OGP 対象 URL を検出し、取得処理と状態を提供するフック。
 *
 * Input:
 * - `text`: 投稿本文
 * - `value`: 現在の OGP 結果
 * - `onChange`: OGP 結果更新通知
 * - `disabled`: 操作可否
 *
 * Output:
 * - 検出 URL・読込状態・ステータス文言・プレビュー URL・取得実行関数
 */
export const useOgpFetch = ({
  text,
  value,
  onChange,
}: UseOgpFetchProps): UseOgpFetchResult => {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [ogpStatus, setOgpStatus] = useState<string | null>(null)
  const [isOgpLoading, setIsOgpLoading] = useState(false)

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
    if (!detectedUrl || isOgpLoading) return

    setIsOgpLoading(true)
    setOgpStatus(null)

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

      setOgpStatus(`OGPを取得しました: ${detectedUrl}`)
      onChange(nextResult)
    } catch (err) {
      console.error(err)
      setOgpStatus("OGP取得中にエラーが発生しました。")
      onChange(null)
    } finally {
      setIsOgpLoading(false)
    }
  }

  /**
   * OGP 取得ステータス文言をクリアする。
   *
   * 処理の趣旨:
   * - 画像選択など、OGP 結果と無関係な操作でステータス表示だけ残るのを防ぐために呼び出す。
   *
   * Output:
   * - 返り値なし（`ogpStatus` を `null` に更新）
   */
  const clearOgpStatus = () => {
    setOgpStatus(null)
  }

  return {
    detectedUrl,
    isOgpLoading,
    ogpStatus,
    previewUrl,
    title: value?.meta.title,
    handleFetchOgp,
    clearOgpStatus,
  }
}

type OgpFetchButtonProps = {
  ogpFetch: UseOgpFetchResult
  disabled?: boolean
}

/**
 * OGP 取得ボタンのみを描画する。
 *
 * Input:
 * - `ogpFetch`: `useOgpFetch` の戻り値
 *
 * Output:
 * - 取得ボタン。検出 URL が無ければ `null`
 */
export const OgpFetchButton: React.FC<OgpFetchButtonProps> = ({
  ogpFetch,
  disabled,
}) => {
  const { detectedUrl, isOgpLoading, handleFetchOgp } = ogpFetch
  if (!detectedUrl) return null

  return (
    <button
      type="button"
      className={`${ui["base-button"]} ${ui["text-button"]} ${ui["white-button"]}`}
      onClick={handleFetchOgp}
      disabled={isOgpLoading || disabled}
    >
      OGP取得
    </button>
  )
}
