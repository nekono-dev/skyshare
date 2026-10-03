import { useMemo } from "react"
import Dropdown from "@/components/common/Dropdown"
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
  ariaLabel?: string
}

/**
 * 表示件数選択用プルダウンを描画する。
 *
 * Input:
 * - `value`: 現在選択中の件数
 * - `onChange`: 選択変更時に呼ぶコールバック
 * - `options`: 選択肢一覧（未指定時は `DEFAULT_PAGE_SIZE_OPTIONS`）
 * - `disabled`/`className`/`id`/`ariaLabel`: 表示・属性制御
 *
 * Output:
 * - 件数候補を持つ `Dropdown`
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
  ariaLabel = "表示件数",
}: PageSizeSelectProps) => {
  const dropdownOptions = useMemo(
    () => options.map(size => ({ value: String(size), label: `${size}件` })),
    [options],
  )

  const handleChange = (next: string) => {
    const size = Number(next)
    if (!Number.isNaN(size)) {
      onChange(size)
    }
  }

  return (
    <Dropdown
      id={id}
      value={String(value)}
      options={dropdownOptions}
      onChange={handleChange}
      disabled={disabled}
      ariaLabel={ariaLabel}
      className={className ? `${styles.select} ${className}` : styles.select}
    />
  )
}

export default Component
