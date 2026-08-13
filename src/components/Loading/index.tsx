import styles from "./index.module.css"

/**
 * 汎用ローディング表示コンポーネント。
 *
 * 責務と処理概要:
 * - インライン表示と全画面オーバーレイ表示を切り替える。
 * - 読み上げ補助のため `role="status"` と `aria-live` を設定する。
 */

type Props = {
  message?: string
  overlay?: boolean
}

/**
 * ローディング UI を表示する。
 *
 * Input:
 * - `message`: 表示メッセージ
 * - `overlay`: `true` の場合は全画面オーバーレイで表示
 *
 * Output:
 * - ローディング表示用 JSX
 *
 * 例:
 * - 入力: `{ message: "保存中...", overlay: true }`
 * - 出力: 背景を覆うスピナー表示
 */
export const Component = ({
  message = "処理中...",
  overlay = false,
}: Props) => {
  if (overlay) {
    return (
      <div className={styles.overlay} role="status" aria-live="polite">
        <div className={styles.panel}>
          <span className={styles.spinner} aria-hidden="true" />
          <p className={styles.message}>{message}</p>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.inline} role="status" aria-live="polite">
      <span className={styles.spinner} aria-hidden="true" />
      <p className={styles.message}>{message}</p>
    </div>
  )
}

export default Component
