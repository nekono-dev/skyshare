import styles from "./index.module.css"

/**
 * 汎用スピナー(回転インジケータ)。
 *
 * 責務と処理概要:
 * - 見た目のみを提供する提示用パーツ。読み上げ対応（role/aria-live）は
 *   利用側（Loading 等、メッセージ文言を持つコンポーネント）が担う。
 */

type Props = {
  className?: string
}

/**
 * スピナー要素を描画する。
 *
 * Input:
 * - `className`: サイズ調整等の追加クラス
 *
 * Output:
 * - スピナー用 JSX
 */
export const Component = ({ className }: Props) => {
  return (
    <span
      className={className ? `${styles.spinner} ${className}` : styles.spinner}
      aria-hidden="true"
    />
  )
}

export default Component
