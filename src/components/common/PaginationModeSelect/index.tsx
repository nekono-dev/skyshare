import type { ChangeEvent } from "react"
import type { PaginationMode } from "@/lib/settings/timelineSettings"
import ui from "@/styles/ui.module.css"
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

const MODE_LABELS: Record<PaginationMode, string> = {
  infinite: "自動読み込み",
  paged: "ページ送り",
}

export type PaginationModeSelectProps = {
  value: PaginationMode
  onChange: (mode: PaginationMode) => void
  disabled?: boolean
  className?: string
  id?: string
  name?: string
  ariaLabel?: string
}

/**
 * ページネーション方式選択用 `<select>` を描画する。
 *
 * Input:
 * - `value`: 現在選択中の方式
 * - `onChange`: 選択変更時に呼ぶコールバック
 * - `disabled`/`className`/`id`/`name`/`ariaLabel`: 表示・属性制御
 *
 * Output:
 * - 方式候補を持つ `<select>` 要素
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
  name = "paginationMode",
  ariaLabel = "ページネーション方式",
}: PaginationModeSelectProps) => {
  const selectClassName = className
    ? `${ui["base-select"]} ${styles.select} ${className}`
    : `${ui["base-select"]} ${styles.select}`

  const handleChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const next = event.target.value
    if (next === "paged" || next === "infinite") {
      onChange(next)
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
        {(Object.entries(MODE_LABELS) as [PaginationMode, string][]).map(
          ([mode, label]) => (
            <option key={mode} value={mode}>
              {label}
            </option>
          ),
        )}
      </select>
    </span>
  )
}

export default Component
