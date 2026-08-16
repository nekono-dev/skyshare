/**
 * 折りたたみコンポーネント。
 *
 * 責務と処理概要:
 * - 任意の子要素を開閉可能な領域へ包み、フォーム内の詳細設定を省スペースで表示する。
 * - `defaultOpen` により初回表示時の開閉状態のみを受け取り、その後の開閉は内部 state で管理する。
 * - アクセシビリティのため、トリガーに `aria-expanded` と `aria-controls` を付与する。
 */
import React, { useId, useState } from "react"
import styles from "./index.module.css"

type Props = {
  label: React.ReactNode
  defaultOpen?: boolean
  children: React.ReactNode
  disabled?: boolean
  className?: string
}

/**
 * 折りたたみの初期開閉状態を正規化する。
 *
 * Input:
 * - `defaultOpen`: 呼び出し元が初回表示時に指定する開閉初期値
 *
 * Output:
 * - 内部 state の初期値として使う boolean
 *
 * 例:
 * - 入力: `true`
 * - 出力: `true`
 */
const resolveDefaultOpen = (defaultOpen: boolean | undefined) => {
  return defaultOpen ?? false
}

/**
 * 折りたたみ UI を描画する。
 *
 * Input:
 * - `label`: 開閉トリガーに表示する見出し
 * - `defaultOpen`: 初回表示時の開閉状態
 * - `children`: 展開時に表示する内容
 * - `disabled`: true の場合は開閉操作を抑止する
 * - `className`: 外側コンテナへ追加する className
 *
 * Output:
 * - 見出しボタンと展開領域を持つ折りたたみ UI
 *
 * 例:
 * - 入力: `{ label: "共有オプション", defaultOpen: true }`
 * - 出力: 初回表示時に開いた折りたたみ領域
 */
export const Component: React.FC<Props> = ({
  label,
  defaultOpen = false,
  children,
  disabled = false,
  className,
}) => {
  const contentId = useId()
  const [open, setOpen] = useState(() => resolveDefaultOpen(defaultOpen))

  return (
    <section
      className={`${styles.container} ${className ? ` ${className}` : ""}`}
    >
      <button
        type="button"
        className={styles.trigger}
        aria-expanded={open}
        aria-controls={contentId}
        disabled={disabled}
        onClick={() => setOpen(prevOpen => !prevOpen)}
      >
        <span className={styles.label}>{label}</span>
        <span
          className={`${styles.indicator}${open ? ` ${styles["indicator-open"]}` : ""}`}
          aria-hidden
        />
      </button>
      {open && (
        <div id={contentId} className={styles.content}>
          {children}
        </div>
      )}
    </section>
  )
}

export default Component
