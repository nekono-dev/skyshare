/**
 * 独立した複数項目を選ぶ、制御式チェックボックス。
 *
 * - ネイティブ入力の表示差を避けるため、入力を視覚的に隠してチェック印を描画する。
 * - `card` の外枠は `RadioButton` と共有し、選択状態は呼び出し側が管理する。
 */
import React, { useId } from "react"
import styles from "./index.module.css"
import ui from "@/styles/ui.module.css"

type Props = {
  /** 現在のチェック状態 */
  checked: boolean
  /** 値が変化した後に呼ばれるコールバック。確定後の値を受け取る。 */
  onCheckedChange: (next: boolean) => void
  /** チェックボックスに付随するラベル内容 */
  label: React.ReactNode
  /** true の場合、操作不能にする */
  disabled?: boolean
  /** 入力要素の id（省略時は自動生成） */
  id?: string
  /** aria-label（labelと共に指定すると aria-label が優先される） */
  "aria-label"?: string
  /** 追加の className（コンテナ要素へ適用） */
  className?: string
  /**
   * 見た目のバリエーション。
   * - "default"（省略時）: インラインの小さなチェックボックス。
   * - "card": `RadioButton`と同じカード状の見た目（`selectable-card`）。
   */
  variant?: "default" | "card"
}

/**
 * チェックボックス UI を描画する。
 *
 * Input:
 * - `checked`: 現在のチェック状態
 * - `onCheckedChange`: 確定後の値を受け取るコールバック
 * - `label`: ラベルとして表示するコンテンツ
 * - `disabled`: true で操作不能化
 * - `id`: 入力要素の id（省略時は自動生成）
 * - `aria-label`: アクセシビリティ用ラベル
 * - `className`: コンテナへの追加クラス
 * - `variant`: "default"（インライン）または "card"（カード状）
 *
 * Output:
 * - チェックボックス（label + input）のマークアップ
 *
 * 例:
 * - 入力: `{ checked: false, onCheckedChange: setAllowFollower, label: "フォロワー" }`
 * - 出力: OFF 状態のチェックボックス + ラベルを含む要素
 */
export const Checkbox = ({
  checked,
  onCheckedChange,
  label,
  disabled = false,
  id,
  "aria-label": ariaLabel,
  className,
  variant = "default",
}: Props) => {
  const generatedId = useId()
  const inputId = id ?? generatedId

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onCheckedChange(e.currentTarget.checked)
  }

  if (variant === "card") {
    return (
      <label
        className={`${ui["base-card"]} ${ui["selectable-card"]} ${checked ? ui["selectable-card-checked"] : ""} ${className ? ` ${className}` : ""}`}
        htmlFor={inputId}
      >
        <input
          id={inputId}
          type="checkbox"
          className={styles.input}
          checked={checked}
          onChange={handleChange}
          disabled={disabled}
          aria-label={ariaLabel}
        />
        <span className={styles.box} aria-hidden />
        <span className={styles["label-text"]}>{label}</span>
      </label>
    )
  }

  return (
    <span
      className={`${ui["block-wrapper"]} ${className ? ` ${className}` : ""}`}
    >
      <label className={styles.label} htmlFor={inputId}>
        <input
          id={inputId}
          type="checkbox"
          className={styles.input}
          checked={checked}
          onChange={handleChange}
          disabled={disabled}
          aria-label={ariaLabel}
        />
        <span className={styles.box} aria-hidden />
        <span className={styles["label-text"]}>{label}</span>
      </label>
    </span>
  )
}

export default Checkbox
