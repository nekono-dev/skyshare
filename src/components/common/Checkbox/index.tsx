/**
 * Checkbox コンポーネント。
 *
 * 責務と処理概要:
 * - boolean 値を持つ設定項目を、複数選択可能なチェックボックスUIとして提供する。
 * - `ToggleSwitch`（ON/OFFスイッチ）とは異なり、フォロワー/フォロー中/メンション等の
 *   組み合わせ選択（複数項目を独立にチェックする用途）向けに、通常のチェックボックス
 *   見た目で実装する。
 * - Controlledコンポーネントとして設計しており、状態管理は常に呼び出し元が担う。
 * - `variant="card"` の場合、`RadioButton`と共有するカードの外枠
 *   （`ui["base-card"]`+`ui["selectable-card"]`/`ui["selectable-card-checked"]`、
 *   `src/styles/button.ui.module.css`）でラップし、カード状の見た目にする。
 * - チェック印は`RadioButton`の丸印（`.dot`）と同様、ネイティブ`<input>`を視覚的に隠し
 *   `.box`（本コンポーネント側）で描画する。ブラウザ間でネイティブチェックボックスの
 *   見た目（`accent-color`の効き方等）が揃わない問題を避けるため。
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
