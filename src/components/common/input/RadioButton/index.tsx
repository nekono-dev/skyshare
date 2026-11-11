/**
 * 複数候補から一つを選ぶ、制御式のカード型ラジオボタン。
 *
 * - 選択時だけ `onSelect` を呼び、選択解除は呼び出し側が別候補を選ぶことで行う。
 * - カード外枠は `Checkbox` の card 表示と共有し、ラジオ固有の印を描画する。
 */
import React, { useId } from "react"
import styles from "./index.module.css"
import ui from "@/styles/ui.module.css"

type Props = {
  /** 現在このオプションが選択されているか */
  checked: boolean
  /** このオプションが選択された時に呼ばれるコールバック */
  onSelect: () => void
  /** カードに表示するラベル内容 */
  label: React.ReactNode
  /** ネイティブradioのグルーピング用（同じグループ内で共通の値を渡す） */
  name: string
  /** true の場合、操作不能にする */
  disabled?: boolean
  /** 入力要素の id（省略時は自動生成） */
  id?: string
  /** 追加の className（カード要素へ適用） */
  className?: string
}

/**
 * カード状のラジオボタンを描画する。
 *
 * Input:
 * - `checked`: このオプションが選択中かどうか
 * - `onSelect`: 選択された時に呼ばれるコールバック
 * - `label`: カードに表示するラベル
 * - `name`: ラジオグループ名
 * - `disabled`: true で操作不能化
 * - `id`: 入力要素の id（省略時は自動生成）
 * - `className`: カードへの追加クラス
 *
 * Output:
 * - ラジオボタン（label + input）のカード状マークアップ
 *
 * 例:
 * - 入力: `{ checked: true, onSelect: () => setReplyAudience("everyone"), label: "誰でも返信可能", name: "reply-audience" }`
 * - 出力: 選択状態（強調枠）のカードボタン
 */
export const RadioButton = ({
  checked,
  onSelect,
  label,
  name,
  disabled = false,
  id,
  className,
}: Props) => {
  const generatedId = useId()
  const inputId = id ?? generatedId

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // ネイティブradioのonChangeは選択された時のみ発火するため、そのままonSelectへ委譲する。
    if (e.currentTarget.checked) onSelect()
  }

  return (
    <label
      className={`${ui["base-card"]} ${ui["selectable-card"]} ${styles.option} ${checked ? ui["selectable-card-checked"] : ""} ${className ? ` ${className}` : ""}`}
      htmlFor={inputId}
    >
      <input
        id={inputId}
        type="radio"
        name={name}
        className={styles.input}
        checked={checked}
        onChange={handleChange}
        disabled={disabled}
      />
      <span className={styles.dot} aria-hidden />
      <span className={styles["label-text"]}>{label}</span>
    </label>
  )
}

export default RadioButton
