import React from "react"
import styles from "./index.module.css"

/**
 * リストボックスの選択肢1行（`role="option"`）。
 *
 * 責務と処理概要:
 * - ハイライト（アクティブ）・選択中・無効の見た目と、mousedownでの確定を担う。
 * - 中身（`children`）の内容や、選択肢の集合・キーボード操作は関知しない。
 *   `Dropdown` と `SuggestPopover` が共用する。
 */

type Props = {
  /** `aria-activedescendant` から参照するための id */
  id: string
  isActive: boolean
  /** 選択中表示。未指定の場合、`aria-selected` はアクティブ状態に従う */
  isSelected?: boolean
  disabled?: boolean
  onHover: () => void
  onSelect: () => void
  children: React.ReactNode
}

/**
 * 選択肢1行を描画する。
 *
 * Input:
 * - `isActive`/`isSelected`/`disabled`: 表示状態
 * - `onHover`: マウスが乗ったときに呼ぶ（無効時は呼ばない）
 * - `onSelect`: mousedownで確定したときに呼ぶ（無効時は呼ばない）
 *
 * Output:
 * - `role="option"` の行
 */
export const ListboxOption: React.FC<Props> = ({
  id,
  isActive,
  isSelected,
  disabled,
  onHover,
  onSelect,
  children,
}) => {
  const className = [
    styles.option,
    isActive && styles["option-active"],
    isSelected && styles["option-selected"],
    disabled && styles["option-disabled"],
  ]
    .filter(Boolean)
    .join(" ")

  return (
    <div
      id={id}
      role="option"
      aria-selected={isSelected ?? isActive}
      aria-disabled={disabled || undefined}
      className={className}
      onMouseEnter={disabled ? undefined : onHover}
      onMouseDown={e => {
        // mousedownはblurより先に発火するため、preventDefault()しておけば
        // 入力欄・トリガーのフォーカスや選択範囲を失わずに確定できる
        // （onClickだと先にblurが走り、確定処理側で正しいカーソル位置が取れなくなる）。
        e.preventDefault()
        if (!disabled) onSelect()
      }}
    >
      {children}
    </div>
  )
}

export default ListboxOption
