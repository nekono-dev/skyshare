import type { ChangeEvent } from "react"
import type { ThemeMode } from "@/lib/settings/themeSettings"
import ui from "@/styles/ui.module.css"
import styles from "./index.module.css"

/**
 * 表示テーマ（システム設定に従う/ライト/ダーク）を選択するプルダウン。
 *
 * 責務と処理概要:
 * - 選択肢一覧からテーマを選ばせるだけの純粋UIコンポーネントで、
 *   永続化やDOMへの反映は呼び出し側の親コンポーネントが決める。
 */

const THEME_MODE_OPTIONS: { value: ThemeMode; label: string }[] = [
  { value: "system", label: "システム設定に従う" },
  { value: "light", label: "ライト" },
  { value: "dark", label: "ダーク" },
]

export type ThemeModeSelectProps = {
  value: ThemeMode
  onChange: (mode: ThemeMode) => void
  disabled?: boolean
  className?: string
  id?: string
  name?: string
  ariaLabel?: string
}

/**
 * 表示テーマ選択用 `<select>` を描画する。
 *
 * Input:
 * - `value`: 現在選択中のテーマ
 * - `onChange`: 選択変更時に呼ぶコールバック
 * - `disabled`/`className`/`id`/`name`/`ariaLabel`: 表示・属性制御
 *
 * Output:
 * - テーマ候補を持つ `<select>` 要素
 *
 * 例:
 * - 入力: `{ value: "system", onChange: fn }`
 * - 出力: 「システム設定に従う」が選択されたテーマ選択プルダウン
 */
export const ThemeModeSelect = ({
  value,
  onChange,
  disabled = false,
  className,
  id = "theme-mode",
  name = "themeMode",
  ariaLabel = "表示テーマ",
}: ThemeModeSelectProps) => {
  const selectClassName = className
    ? `${ui["base-select"]} ${styles.select} ${className}`
    : `${ui["base-select"]} ${styles.select}`

  const handleChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const next = event.target.value
    if (THEME_MODE_OPTIONS.some(option => option.value === next)) {
      onChange(next as ThemeMode)
    }
  }

  return (
    <span className={ui["select-wrapper"]}>
      <select
        id={id}
        name={name}
        className={selectClassName}
        value={value}
        onChange={handleChange}
        disabled={disabled}
        aria-label={ariaLabel}
      >
        {THEME_MODE_OPTIONS.map(option => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </span>
  )
}

export default ThemeModeSelect
