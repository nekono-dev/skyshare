import type { ChangeEvent } from "react"
import ui from "@/styles/ui.module.css"
import styles from "./index.module.css"

/**
 * 1ページあたりの表示件数を選択するプルダウン。
 *
 * 責務と処理概要:
 * - 選択肢一覧から件数を選ばせるだけの純粋UIコンポーネントで、
 *   `ComponentList` や一覧取得ロジックには一切依存しない。
 * - 選択された件数をどう使うか（`cursorPagination.pageSize` に反映する等）は
 *   呼び出し側の親コンポーネントが決める。これにより ComponentList との連携は
 *   常に親コンポーネントを介した疎結合になる。
 */

export const DEFAULT_PAGE_SIZE_OPTIONS = [5, 10, 20, 50, 100]

export type PageSizeSelectProps = {
  value: number
  onChange: (size: number) => void
  options?: number[]
  disabled?: boolean
  className?: string
  id?: string
  name?: string
  ariaLabel?: string
}

/**
 * 表示件数選択用 `<select>` を描画する。
 *
 * Input:
 * - `value`: 現在選択中の件数
 * - `onChange`: 選択変更時に呼ぶコールバック
 * - `options`: 選択肢一覧（未指定時は `DEFAULT_PAGE_SIZE_OPTIONS`）
 * - `disabled`/`className`/`id`/`name`/`ariaLabel`: 表示・属性制御
 *
 * Output:
 * - 件数候補を持つ `<select>` 要素
 *
 * 例:
 * - 入力: `{ value: 20, onChange: fn }`
 * - 出力: 「20件」が選択された表示件数プルダウン
 */
export const Component = ({
  value,
  onChange,
  options = DEFAULT_PAGE_SIZE_OPTIONS,
  disabled = false,
  className,
  id = "page-size",
  name = "pageSize",
  ariaLabel = "表示件数",
}: PageSizeSelectProps) => {
  const selectClassName = className
    ? `${ui.baseSelect} ${styles.select} ${className}`
    : `${ui.baseSelect} ${styles.select}`

  const handleChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const next = Number(event.target.value)
    if (!Number.isNaN(next)) {
      onChange(next)
    }
  }

  return (
    <span className={ui.selectWrapper}>
      <select
        id={id}
        name={name}
        className={selectClassName}
        value={value}
        onChange={handleChange}
        disabled={disabled}
        aria-label={ariaLabel}
      >
        {options.map(option => (
          <option key={option} value={option}>
            {`${option}件`}
          </option>
        ))}
      </select>
    </span>
  )
}

export default Component
