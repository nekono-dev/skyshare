/**
 * 画像サムネイルを表示し、操作可能な場合はライトボックスを開く。
 *
 * - 4枚以下はグリッド、5枚以上は横スクロールにし、非操作表示でも同じレイアウトを保つ。
 */
import { useT } from "@/components/i18n/useTranslation"
import React, { useRef, useState } from "react"
import ImageLightbox from "@/components/image/ImageGallery/ImageLightbox"
import type { SourceImage } from "@/lib/entry/entry"
import { resolveGalleryLayout } from "@/lib/image/galleryLayout"
import { MAX_POST_IMAGES } from "@/lib/image/postImageLimits"
import styles from "./index.module.css"

type Props = {
  images: SourceImage[]
  interactive?: boolean
}

/**
 * サムネイルを描画する。
 *
 * Input:
 * - `images`: 最大 `MAX_POST_IMAGES` 枚（超過分は描画しない）
 * - `interactive`: 既定 `true`
 *
 * Output:
 * - 画像が0枚の場合 `null`
 */
const ImageGallery = ({ images: allImages, interactive = true }: Props) => {
  const { t } = useT()
  const images = allImages.slice(0, MAX_POST_IMAGES)
  const layout = resolveGalleryLayout(images)
  const [openIndex, setOpenIndex] = useState<number | null>(null)
  const thumbRefs = useRef<(HTMLButtonElement | null)[]>([])

  if (!layout) return null

  const close = () => {
    const closed = openIndex
    setOpenIndex(null)
    if (closed !== null) {
      // 拡大表示のアンマウント後にフォーカスを戻す
      requestAnimationFrame(() => thumbRefs.current[closed]?.focus())
    }
  }

  const containerClass =
    layout.kind === "strip"
      ? styles.strip
      : `${styles.grid} ${styles[`grid-${layout.count}`]}`
  const containerStyle: React.CSSProperties | undefined =
    layout.kind === "grid" && layout.count === 1
      ? { aspectRatio: String(layout.singleRatio) }
      : undefined

  return (
    <>
      <div className={containerClass} style={containerStyle}>
        {images.map((image, i) => {
          const ratio = image.aspectRatio
          const cellStyle: React.CSSProperties | undefined =
            layout.kind === "strip" && ratio
              ? { aspectRatio: `${ratio.width} / ${ratio.height}` }
              : undefined
          const cellClass =
            layout.kind === "strip" ? styles["strip-cell"] : styles["grid-cell"]
          const imgClass =
            layout.kind === "strip" && !ratio
              ? styles["strip-img-auto"]
              : styles.img
          const img = (
            <img
              className={imgClass}
              src={image.url}
              alt={image.alt}
              loading="lazy"
              decoding="async"
            />
          )
          if (!interactive) {
            return (
              <div
                key={`${image.cid}-${i}`}
                className={cellClass}
                style={cellStyle}
              >
                {img}
              </div>
            )
          }
          return (
            <button
              key={`${image.cid}-${i}`}
              ref={el => {
                thumbRefs.current[i] = el
              }}
              type="button"
              className={cellClass}
              style={cellStyle}
              aria-label={t("image.gallery.enlarge", {
                index: i + 1,
                total: images.length,
              })}
              onClick={() => setOpenIndex(i)}
            >
              {img}
            </button>
          )
        })}
      </div>
      {interactive && openIndex !== null && (
        <ImageLightbox
          images={images}
          index={openIndex}
          onIndexChange={setOpenIndex}
          onClose={close}
        />
      )}
    </>
  )
}

export default ImageGallery
