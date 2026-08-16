/**
 * 下書き一覧表示パネル。
 *
 * 責務と処理概要:
 * - 親から渡された `items`（取得済みの下書き配列）を `ComponentList` と `NavigationBar` で
 *   5 件単位に区切って表示する、完全にローカルなページングを行う。
 * - 1件選択時は親へ選択イベントを委譲する。
 */
import { useEffect, useState } from "react"
import ComponentList from "@/components/ComponentList"
import type { CursorPaginationViewModel } from "@/components/ComponentList"
import NavigationBar from "@/components/NavigationBar"
import { SELF_LABEL_OPTIONS } from "@/components/SelfLabelsSelect"
import type { DraftListItem } from "@/lib/entry/draftList"
import ui from "@/styles/ui.module.css"
import styles from "./index.module.css"

export type DraftListPanelProps = {
  items: DraftListItem[]
  loading?: boolean
  error?: string
  emptyText?: string
  onSelectDraft: (draft: DraftListItem) => void | Promise<void>
}

const PAGE_SIZE = 5

const LABEL_TEXT_BY_VALUE = new Map(
  SELF_LABEL_OPTIONS.map(option => [option.value as string, option.label]),
)

/**
 * updatedAt を一覧表示用の日時文字列に整形する。
 *
 * Input:
 * - `updatedAt`: ISO 8601 文字列
 *
 * Output:
 * - `ja-JP` ロケールの日時表記
 *
 * 例:
 * - 入力: `"2026-08-13T09:00:00.000Z"`
 * - 出力: `"2026/08/13 18:00"`
 */
const formatUpdatedAt = (updatedAt: string): string =>
  new Date(updatedAt).toLocaleString("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  })

const DraftListRow = ({
  item,
  onUse,
}: {
  item: DraftListItem
  onUse: (draft: DraftListItem) => void | Promise<void>
}) => (
  <div
    role="button"
    tabIndex={0}
    className={`${styles.row} ${ui["card-select"]}`}
    onClick={() => void onUse(item)}
    onKeyDown={event => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault()
        void onUse(item)
      }
    }}
  >
    <p className={styles.text}>{item.text || "（本文なし）"}</p>
    <div className={styles.meta}>
      {item.labels?.map(label => (
        <span key={label} className={styles["label-pill"]}>
          {LABEL_TEXT_BY_VALUE.get(label) ?? label}
        </span>
      ))}
      <span className={styles["updated-at"]}>
        {formatUpdatedAt(item.updatedAt)}
      </span>
    </div>
  </div>
)

const DraftListPanel = ({
  items,
  loading,
  error,
  emptyText = "下書きがありません。",
  onSelectDraft,
}: DraftListPanelProps) => {
  const [page, setPage] = useState(0)

  useEffect(() => {
    setPage(0)
  }, [items])

  const pageStart = page * PAGE_SIZE
  const pageItems = items.slice(pageStart, pageStart + PAGE_SIZE)
  const hasPrevPage = page > 0
  const hasNextPage = pageStart + PAGE_SIZE < items.length

  const pagination: CursorPaginationViewModel = {
    hasPrevPage,
    hasNextPage,
    currentPage: page + 1,
    loading: false,
    onPrev: () => setPage(prev => Math.max(0, prev - 1)),
    onNext: () => setPage(prev => (hasNextPage ? prev + 1 : prev)),
  }

  const empty = items.length === 0

  return (
    <div>
      {loading || error || empty ? (
        <p className={error ? styles["error-state"] : styles["empty-state"]}>
          {error ?? (loading ? "読み込み中…" : emptyText)}
        </p>
      ) : (
        <ComponentList
          itemComponent={DraftListRow}
          getItemProps={item => ({ onUse: () => void onSelectDraft(item) })}
          getItemKey={item => item.id}
          className={styles.list}
          items={pageItems}
        />
      )}

      <NavigationBar
        pagination={pagination}
        ariaLabel="draft list pagination"
      />
    </div>
  )
}

export default DraftListPanel
