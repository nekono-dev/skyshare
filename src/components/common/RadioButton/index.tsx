/**
 * RadioButton コンポーネント。
 *
 * 責務と処理概要:
 * - 複数選択肢から1つを選ぶ、カード状のラジオボタンUIを提供する
 *   （Bluesky公式アプリの「返信できるユーザー」選択のような、横並びの大きめカードボタン）。
 * - Controlledコンポーネントとして設計しており、状態管理は常に呼び出し元が担う。
 * - ネイティブ`<input type="radio">`の性質上、選択された時のみ`onSelect`を呼ぶ
 *   （Checkboxの`onCheckedChange(next: boolean)`とは異なり、選択解除は呼び出し元が
 *   別の選択肢の`onSelect`を通じて行う）。
 * - カードの外枠（境界線・背景・角丸）は`Checkbox`(variant="card")と共有する
 *   `ui["base-card"]`+`ui["selectable-card"]`/`ui["selectable-card-checked"]`
 *   （`src/styles/button.ui.module.css`）を使う。ラジオ固有の丸印（`.dot`）のみ
 *   このコンポーネント側で持つ。
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
