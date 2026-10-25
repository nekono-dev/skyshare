/**
 * 下書き一覧表示パネル。
 *
 * 責務と処理概要:
 * - 親から渡された `items`（取得済みの下書き配列）を `ComponentList` と `NavigationBar` で
 *   5 件単位に区切って表示する、完全にローカルなページングを行う。
 * - 1件選択時は親へ選択イベントを委譲する。
 */
import { useFormat, useT } from "@/lib/i18n/react"
import { useEffect, useState } from "react"
import ComponentList from "@/components/common/ComponentList"
import type { CursorPaginationViewModel } from "@/components/common/ComponentList"
import NavigationBar from "@/components/common/NavigationBar"
import { SELF_LABEL_OPTIONS } from "@/components/post/SelfLabelsSelect"
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

/** 自己ラベル値 → 表示文言のキー（表示時に現在の表示言語で翻訳する） */
const LABEL_KEY_BY_VALUE = new Map(
  SELF_LABEL_OPTIONS.map(option => [option.value as string, option.labelKey]),
)

/** 下書きの更新日時を一覧表示用に整形する際の Intl オプション。 */
const UPDATED_AT_FORMAT: Intl.DateTimeFormatOptions = {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
}

/** 自己ラベル値に対応する文言キー。未知の値は `undefined`。 */
const labelKeyFor = (value: string) => LABEL_KEY_BY_VALUE.get(value)

const DraftListRow = ({
  item,
  onUse,
}: {
  item: DraftListItem
  onUse: (draft: DraftListItem) => void | Promise<void>
}) => {
  const { t, tn } = useT()
  const { formatDateTime } = useFormat()
  // このパネルはまだスレッド(複数posts)の下書きを一覧上で個別表示するUIを持たないため、
  // 先頭セグメントのみをプレビューとして表示する（2件目以降を持つ下書きも一覧には出る）。
  const firstPost = item.posts[0]

  return (
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
      <p className={styles.text}>{firstPost?.text || t("entry.noText")}</p>
      <div className={styles.meta}>
        {firstPost?.labels?.map(label => (
          <span key={label} className={styles["label-pill"]}>
            {labelKeyFor(label) ? t(labelKeyFor(label)!) : label}
          </span>
        ))}
        {item.posts.length > 1 && (
          <span className={styles["label-pill"]}>
            {tn("entry.draft.thread", item.posts.length)}
          </span>
        )}
        <span className={styles["updated-at"]}>
          {formatDateTime(item.updatedAt, UPDATED_AT_FORMAT)}
        </span>
      </div>
    </div>
  )
}

const DraftListPanel = ({
  items,
  loading,
  error,
  emptyText,
  onSelectDraft,
}: DraftListPanelProps) => {
  const { t } = useT()
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
          {error ??
            (loading
              ? t("common.loading")
              : (emptyText ?? t("entry.draft.empty")))}
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
        ariaLabel={t("entry.draft.paginationAria")}
      />
    </div>
  )
}

export default DraftListPanel
