import { useT } from "@/lib/i18n/react"
import React, { useEffect, useRef, useState } from "react"
import Overlay from "@/components/common/Overlay"
import type { SourceImage } from "@/lib/entry/entry"
import styles from "./index.module.css"

/**
 * 画像の拡大表示（ライトボックス）。
 *
 * 責務と処理概要:
 * - `Overlay` を土台に、画像を画面全体へ重ねて表示する（Esc・背景クリック・スクロールロックは Overlay が担う）。
 * - 複数枚のとき、前後ボタン・左右矢印キー・左右スワイプで画像を切り替える。
 * - 切り替えはスライドアニメーションで行う。前後の画像を横に並べ、スワイプ中は指に追従させ、
 *   離したときに閾値を超えていれば隣へ移動し、満たなければ元の位置へ戻す。
 * - マウント時に閉じるボタンへフォーカスし、Tab を拡大表示内の操作要素だけで巡回させる。
 * - 現在の画像と前後1枚だけをスライドとして描画する（隣の画像はスライド描画により先読みされる）。
 * - 設計: specs/image-gallery
 */

type Props = {
  images: SourceImage[]
  index: number
  onIndexChange: (next: number) => void
  onClose: () => void
}

/** スワイプとみなす横方向の最小移動量(px) */
const SWIPE_THRESHOLD = 50

/** ドラッグ開始とみなす横方向の移動量(px)。これ未満はタップとして扱う */
const DRAG_START_DISTANCE = 8

/** 端の画像でさらに引っ張ったときの追従率（ゴム紐のような抵抗感を出す） */
const EDGE_RESISTANCE = 0.3

/**
 * 拡大表示を描画する。
 *
 * Input:
 * - `images`: 同一投稿内の画像一覧
 * - `index`: 現在表示中の画像インデックス
 * - `onIndexChange`: 切り替え時に次のインデックスを通知する
 * - `onClose`: 閉じる操作の通知
 */
const ImageLightbox = ({ images, index, onIndexChange, onClose }: Props) => {
  const { t } = useT()
  const rootRef = useRef<HTMLDivElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  const swipeStartX = useRef<number | null>(null)
  const swiped = useRef(false)
  // スワイプ中の横方向のずれ(px)。null 以外の間はアニメーションを止めて指に追従させる
  const [dragX, setDragX] = useState<number | null>(null)
  const multiple = images.length > 1
  const current = images[index]

  const go = (next: number) => {
    if (next < 0 || next >= images.length) return
    onIndexChange(next)
  }
  // keydown ハンドラから常に最新の index / go を参照するため ref に保持する
  const goRef = useRef(go)
  goRef.current = go
  const indexRef = useRef(index)
  indexRef.current = index

  useEffect(() => {
    closeRef.current?.focus()
  }, [])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft" && multiple) {
        goRef.current(indexRef.current - 1)
      } else if (e.key === "ArrowRight" && multiple) {
        goRef.current(indexRef.current + 1)
      } else if (e.key === "Tab") {
        const focusables = Array.from(
          rootRef.current?.querySelectorAll<HTMLElement>(
            "button:not([disabled])",
          ) ?? [],
        )
        if (focusables.length === 0) return
        const first = focusables[0]
        const last = focusables[focusables.length - 1]
        const active = document.activeElement
        if (!rootRef.current?.contains(active)) {
          e.preventDefault()
          first.focus()
        } else if (e.shiftKey && active === first) {
          e.preventDefault()
          last.focus()
        } else if (!e.shiftKey && active === last) {
          e.preventDefault()
          first.focus()
        }
      }
    }
    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [multiple])

  /**
   * スワイプの起点を記録する。ボタン上の操作はスワイプとして扱わない。
   *
   * Input:
   * - `e`: 画像領域の pointerdown イベント
   */
  const handlePointerDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest("button")) return
    swipeStartX.current = e.clientX
    swiped.current = false
  }

  /**
   * ドラッグ量に応じてスライドを追従させる。
   * 移動量が小さい間はタップとみなし、何もしない（画像のクリックを妨げないため）。
   *
   * Input:
   * - `e`: 画像領域の pointermove イベント
   */
  const handlePointerMove = (e: React.PointerEvent) => {
    const startX = swipeStartX.current
    if (startX === null || !multiple) return
    const dx = e.clientX - startX
    if (dragX === null) {
      if (Math.abs(dx) < DRAG_START_DISTANCE) return
      // ポインタが領域外へ出ても pointerup を受け取れるよう、ドラッグ確定後に捕捉する
      e.currentTarget.setPointerCapture(e.pointerId)
      swiped.current = true
    }
    // 先頭・末尾でさらに引いた場合は、隣が無いので追従量を抑える
    const noNeighbor =
      (dx > 0 && index === 0) || (dx < 0 && index === images.length - 1)
    setDragX(noNeighbor ? dx * EDGE_RESISTANCE : dx)
  }

  /**
   * ドラッグを終了し、閾値を超えていれば隣の画像へ、満たなければ元へ戻す。
   *
   * Input:
   * - `e`: 画像領域の pointerup / pointercancel イベント
   */
  const handlePointerEnd = (e: React.PointerEvent) => {
    const startX = swipeStartX.current
    swipeStartX.current = null
    if (startX === null || dragX === null) return
    const dx = e.clientX - startX
    setDragX(null)
    if (e.type === "pointercancel" || Math.abs(dx) < SWIPE_THRESHOLD) return
    go(dx < 0 ? index + 1 : index - 1)
  }

  // 全画面の内容領域が Overlay の背景を覆うため、画像・ボタン・キャプション以外（余白）の
  // クリックを背景クリックとして閉じる。スワイプ直後の click は無視する。
  const handleBlankClick = (e: React.MouseEvent) => {
    if (e.target !== e.currentTarget) return
    if (swiped.current) {
      swiped.current = false
      return
    }
    onClose()
  }

  if (!current) return null

  return (
    <Overlay
      open
      onClose={onClose}
      backdropClassName={styles["lightbox-backdrop"]}
      contentClassName={styles["lightbox-content"]}
    >
      <div
        ref={rootRef}
        className={styles.root}
        role="dialog"
        aria-modal="true"
        aria-label={t("image.lightbox.aria")}
        onClick={handleBlankClick}
      >
        <button
          ref={closeRef}
          type="button"
          className={styles["close-button"]}
          aria-label={t("common.close")}
          onClick={onClose}
        >
          ×
        </button>
        <div
          className={styles["image-area"]}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerEnd}
          onPointerCancel={handlePointerEnd}
          onClick={handleBlankClick}
        >
          {multiple && (
            <button
              type="button"
              className={`${styles["nav-button"]} ${styles["nav-prev"]}`}
              aria-label={t("image.lightbox.prev")}
              disabled={index === 0}
              onClick={() => go(index - 1)}
            >
              ‹
            </button>
          )}
          {[index - 1, index, index + 1].map(i => {
            const image = images[i]
            if (!image) return null
            // スライドは画像のインデックスをキーにし、切り替え時に同じ要素が隣の位置へ滑るようにする
            return (
              <div
                key={i}
                className={styles.slide}
                data-current={i === index}
                aria-hidden={i !== index}
                style={{
                  transform: `translateX(calc(${(i - index) * 100}% + ${dragX ?? 0}px))`,
                  transition: dragX === null ? undefined : "none",
                }}
              >
                <img
                  className={styles.image}
                  src={image.url}
                  alt={i === index ? image.alt : ""}
                  draggable={false}
                />
              </div>
            )
          })}
          {multiple && (
            <button
              type="button"
              className={`${styles["nav-button"]} ${styles["nav-next"]}`}
              aria-label={t("image.lightbox.next")}
              disabled={index === images.length - 1}
              onClick={() => go(index + 1)}
            >
              ›
            </button>
          )}
        </div>
        <div className={styles.caption}>
          {current.alt && <p className={styles.alt}>{current.alt}</p>}
          {multiple && (
            <p className={styles.position} aria-live="polite">
              {index + 1}/{images.length}
            </p>
          )}
        </div>
      </div>
    </Overlay>
  )
}

export default ImageLightbox
