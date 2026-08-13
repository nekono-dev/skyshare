import React, { useEffect } from "react"
import { createPortal } from "react-dom"
import styles from "./index.module.css"

/**
 * クリックで閉じられるモーダル用オーバーレイコンポーネント。
 *
 * 責務と処理概要:
 * - `open` が `true` のときだけ背景と内容を描画する。
 * - 背景クリックで `onClose` を呼び、内容クリックは伝播を止める。
 * - 表示中は背面のスクロールを止め、スクロール操作が内容領域（PostForm など）へ向くようにする。
 * - ブラウザ環境では `createPortal` で `document.body` 配下へ描画する。
 */

type Props = {
  open: boolean
  onClose: () => void
  children: React.ReactNode
  contentClassName?: string
  contentStyle?: React.CSSProperties
}

/**
 * オーバーレイと内容領域を描画する。
 *
 * Input:
 * - `open`: 表示状態
 * - `onClose`: 背景クリック時のクローズ処理
 * - `children`: 表示する内容
 * - `contentClassName`: 内容領域に追加するクラス名
 *
 * Output:
 * - `open=false` の場合 `null`
 * - `open=true` の場合 オーバーレイ JSX（環境に応じて通常描画/Portal描画）
 *
 * 例:
 * - 入力: `{ open: true, children: <Dialog /> }`
 * - 出力: 画面全体の backdrop 上に Dialog を表示
 */
const Overlay: React.FC<Props> = ({
  open,
  onClose,
  children,
  contentClassName,
  contentStyle,
}) => {
  useEffect(() => {
    if (!open || typeof document === "undefined") return

    const { overflow } = document.body.style
    document.body.style.overflow = "hidden"

    return () => {
      document.body.style.overflow = overflow
    }
  }, [open])

  if (!open) return null

  const overlay = (
    <div className={styles.backdrop} onClick={onClose} role="presentation">
      <div
        className={[styles.content, contentClassName].filter(Boolean).join(" ")}
        style={contentStyle}
        onClick={e => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  )

  if (typeof document === "undefined") {
    return overlay
  }

  return createPortal(overlay, document.body)
}

export default Overlay
