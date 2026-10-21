import { useT } from "@/lib/i18n/react"
import React from "react"
import type { UseOgpFetchResult } from "@/components/image/OgpFetchButton"
import MediaThumb from "@/components/common/MediaThumb"
import ui from "@/styles/ui.module.css"
import styles from "./index.module.css"

/**
 * OGP 取得ステータスと画像プレビューを描画するコンポーネント。
 *
 * 責務と処理概要:
 * - `useOgpFetch`（`@/components/image/OgpFetchButton`）が返す状態を受け取り表示する。
 * - レイアウトの自由度を確保するため、ボタン（`OgpFetchButton`）とは別コンポーネントに分離している。
 */

type Props = {
  ogpFetch: UseOgpFetchResult
  /** リンクカードを投稿から外す。省略時は取り外しボタンを出さない */
  onRemove?: () => void
  disabled?: boolean
}

/**
 * OGP 取得ステータスと画像プレビューを描画する。
 *
 * Input:
 * - `ogpFetch`: `useOgpFetch` の戻り値
 * - `onRemove`: 取り外しボタン押下時の処理（画像・動画と同じ「×」ボタン）
 * - `disabled`: 取り外しボタンの無効化
 *
 * Output:
 * - 取得状況・プレビュー UI。表示すべき内容が無ければ `null`
 */
export const Component: React.FC<Props> = ({
  ogpFetch,
  onRemove,
  disabled,
}) => {
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

      {previewUrl &&
        (onRemove ? (
          <MediaThumb
            className={styles["thumb"]}
            removeAriaLabel={t("image.ogp.remove")}
            onRemove={onRemove}
            disabled={disabled}
            testId="ogp-preview"
          >
            <img
              src={previewUrl}
              alt={title || t("image.ogp.imageAlt")}
              className={styles["image"]}
              loading="lazy"
            />
          </MediaThumb>
        ) : (
          <div className={ui.center}>
            <img
              src={previewUrl}
              alt={title || t("image.ogp.imageAlt")}
              className={ui.preview}
              loading="lazy"
            />
          </div>
        ))}
    </div>
  )
}

export default Component
