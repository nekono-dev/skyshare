import type { ThemeMode } from "@/lib/settings/themeSettings"
import Dropdown from "@/components/common/Dropdown"
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
  ariaLabel?: string
}

/**
 * 表示テーマ選択用プルダウンを描画する。
 *
 * Input:
 * - `value`: 現在選択中のテーマ
 * - `onChange`: 選択変更時に呼ぶコールバック
 * - `disabled`/`className`/`id`/`ariaLabel`: 表示・属性制御
 *
 * Output:
 * - テーマ候補を持つ `Dropdown`
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
  ariaLabel = "表示テーマ",
}: ThemeModeSelectProps) => {
  const handleChange = (next: string) => {
    if (THEME_MODE_OPTIONS.some(option => option.value === next)) {
      onChange(next as ThemeMode)
    }
  }

  return (
    <Dropdown
      id={id}
      value={value}
      options={THEME_MODE_OPTIONS}
      onChange={handleChange}
      disabled={disabled}
      ariaLabel={ariaLabel}
      className={className ? `${styles.select} ${className}` : styles.select}
    />
  )
}

export default ThemeModeSelect
