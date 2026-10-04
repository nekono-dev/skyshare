import React, { useRef, useState } from "react"
import ImageLightbox from "@/components/image/ImageLightbox"
import type { SourceImage } from "@/lib/entry/entry"
import { resolveGalleryLayout } from "@/lib/image/galleryLayout"
import { MAX_POST_IMAGES } from "@/lib/image/postImageLimits"
import styles from "./index.module.css"

/**
 * 画像のサムネイル表示。タップで `ImageLightbox` を開く。
 *
 * 責務と処理概要:
 * - 4枚以下は比率固定でクロップするグリッド、5枚以上は高さ固定の横スクロール1行（`resolveGalleryLayout`）。
 * - 拡大中の画像インデックスを保持し、閉じたときに開いたサムネイルへフォーカスを戻す。
 * - `interactive=false` のときは拡大表示を持たない静的表示にする（レイアウトは同一）。
 * - 設計: specs/postcardlayout/design.md §3.1
 */

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
              aria-label={`画像${i + 1}/${images.length}を拡大`}
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
