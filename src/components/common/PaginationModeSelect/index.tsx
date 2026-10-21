import { useT } from "@/lib/i18n/react"
import type { PlainMessageKey } from "@/lib/i18n/translate"
import type { PaginationMode } from "@/lib/settings/timelineSettings"
import Dropdown from "@/components/common/Dropdown"
import styles from "./index.module.css"

/**
 * ページネーション方式（ページ送り/無限スクロール）を選択するプルダウン。
 *
 * 責務と処理概要:
 * - 方式の一覧から選ばせるだけの純粋UIコンポーネントで、
 *   `ComponentList` や一覧取得ロジックには一切依存しない。
 * - 選択された方式をどう使うか（`useCursorPaginationController`/
 *   `useInfiniteScrollController` のどちらを有効にするか）は呼び出し側の
 *   親コンポーネントが決める。
 */

const MODE_OPTIONS: { value: PaginationMode; labelKey: PlainMessageKey }[] = [
  { value: "infinite", labelKey: "common.paginationMode.infinite" },
  { value: "paged", labelKey: "common.paginationMode.paged" },
]

export type PaginationModeSelectProps = {
  value: PaginationMode
  onChange: (mode: PaginationMode) => void
  disabled?: boolean
  className?: string
  id?: string
  ariaLabel?: string
}

/**
 * ページネーション方式選択用プルダウンを描画する。
 *
 * Input:
 * - `value`: 現在選択中の方式
 * - `onChange`: 選択変更時に呼ぶコールバック
 * - `disabled`/`className`/`id`/`ariaLabel`: 表示・属性制御
 *
 * Output:
 * - 方式候補を持つ `Dropdown`
 *
 * 例:
 * - 入力: `{ value: "paged", onChange: fn }`
 * - 出力: 「ページ送り」が選択されたページネーション方式プルダウン
 */
export const Component = ({
  value,
  onChange,
  disabled = false,
  className,
  id = "pagination-mode",
  ariaLabel,
}: PaginationModeSelectProps) => {
  const { t } = useT()
  const options = MODE_OPTIONS.map(option => ({
    value: option.value,
    label: t(option.labelKey),
  }))
  const handleChange = (next: string) => {
    if (next === "paged" || next === "infinite") {
      onChange(next)
    }
  }

  return (
    <Dropdown
      id={id}
      value={value}
      options={options}
      onChange={handleChange}
      disabled={disabled}
      ariaLabel={ariaLabel ?? t("common.paginationMode")}
      className={className ? `${styles.select} ${className}` : styles.select}
    />
  )
}

export default Component
