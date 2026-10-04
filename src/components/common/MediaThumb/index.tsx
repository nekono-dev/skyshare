import type { CSSProperties, ReactNode } from "react"
import styles from "./index.module.css"

/**
 * 投稿フォームの添付メディア（画像・動画）1枚分のサムネイル枠。
 *
 * 責務と処理概要:
 * - サムネイルの中身（`children`）を枠に収め、右上に取り外し「×」、右下に「alt」ボタンを重ねる。
 * - 画像（`ImagePicker`）と動画（`VideoPicker`）で、ボタンの見た目と大きさを揃えるための共通部品。
 */

type Props = {
  onRemove: () => void
  onEditAlt: () => void
  removeAriaLabel: string
  altAriaLabel: string
  /** alt 入力済みなら強調色にする */
  altFilled: boolean
  disabled?: boolean
  /** グリッド配置（gridArea）用 */
  style?: CSSProperties
  /** 配置先ごとの追加クラス（枠の寸法・角丸など） */
  className?: string
  testId?: string
  /** サムネイルの中身（`<img>` と、必要なら追加のバッジ） */
  children: ReactNode
}

export const MediaThumb = ({
  onRemove,
  onEditAlt,
  removeAriaLabel,
  altAriaLabel,
  altFilled,
  disabled = false,
  style,
  className,
  testId,
  children,
}: Props) => {
  return (
    <div
      className={`${styles["thumb-item"]} ${className ?? ""}`}
      style={style}
      data-testid={testId}
    >
      {children}
      <button
        type="button"
        className={styles["remove-badge"]}
        aria-label={removeAriaLabel}
        onClick={onRemove}
        disabled={disabled}
      >
        ×
      </button>
      <button
        type="button"
        className={`${styles["alt-badge"]} ${altFilled ? styles["alt-badge-active"] : ""}`}
        aria-label={altAriaLabel}
        onClick={onEditAlt}
        disabled={disabled}
      >
        alt
      </button>
    </div>
  )
}

export default MediaThumb
