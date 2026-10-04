import { useT } from "@/lib/i18n/react"
import React from "react"
import type { UseOgpFetchResult } from "@/components/image/OgpFetchButton"
import ui from "@/styles/ui.module.css"

/**
 * OGP 取得ステータスと画像プレビューを描画するコンポーネント。
 *
 * 責務と処理概要:
 * - `useOgpFetch`（`@/components/image/OgpFetchButton`）が返す状態を受け取り表示する。
 * - レイアウトの自由度を確保するため、ボタン（`OgpFetchButton`）とは別コンポーネントに分離している。
 */

type Props = {
  ogpFetch: UseOgpFetchResult
}

/**
 * OGP 取得ステータスと画像プレビューを描画する。
 *
 * Input:
 * - `ogpFetch`: `useOgpFetch` の戻り値
 *
 * Output:
 * - 取得状況・プレビュー UI。表示すべき内容が無ければ `null`
 */
export const Component: React.FC<Props> = ({ ogpFetch }) => {
  const translator = useT()
  const { t } = translator
  const { isOgpLoading, ogpStatus, previewUrl, title } = ogpFetch
  if (!isOgpLoading && !ogpStatus && !previewUrl) return null

  return (
    <div className={ui["base-card"]}>
      {isOgpLoading && <div className={ui.label}>{t("image.ogp.loading")}</div>}
      {!isOgpLoading && ogpStatus && (
        <div className={ui.label}>{ogpStatus.format(translator)}</div>
      )}

      {previewUrl && (
        <div className={ui.center}>
          <img
            src={previewUrl}
            alt={title || t("image.ogp.imageAlt")}
            className={ui.preview}
            loading="lazy"
          />
        </div>
      )}
    </div>
  )
}

export default Component
