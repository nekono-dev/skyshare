/**
 * 作成した Skyshare Entry の一覧を表示するクライアントコンポーネント。
 *
 * 責務と処理概要:
 * - `GET /v2/entries/skyshare` 取得処理を定義し、一覧コンポーネントへ提供する。
 *   絞り込みは行わず全Entryを取得する（紐づく Bluesky 投稿が削除済みかどうかは
 *   各Entryの `orphaned` フラグとして返り、`EntryCard` 側で背景色による識別を行う）。
 * - ページング状態の管理は `Timeline` と同様に `ComponentList` 側へ委譲する。
 * - `PostLauncher` に相当する作成 UI は持たない（既存投稿からの発行のみのため）。
 */

import { useCallback, useState } from "react"
import { getSkyshareEntries } from "@/client/openapi/client"
import ComponentList from "@/components/ComponentList"
import type {
  CursorPageFetchInput,
  CursorPageFetchResult,
} from "@/components/ComponentList"
import { useCursorPaginationController } from "@/components/ComponentList"
import NavigationBar from "@/components/NavigationBar"
import PageSizeSelect from "@/components/PageSizeSelect"
import EntryCard from "@/components/EntryCard"
import type { TimelineSkyshareEntry } from "@/lib/posts"
import {
  readPageSizeSetting,
  writePageSizeSetting,
} from "@/lib/timelineSettings"
import ui from "@/styles/ui.module.css"
import styles from "./index.module.css"

const PAGE_SIZE = 20

/**
 * Entry一覧を読み込み、ページングを管理する。
 *
 * Output:
 * - 一覧表示を含む UI
 */
const Component = () => {
  const [pageSize, setPageSize] = useState(() => readPageSizeSetting(PAGE_SIZE))

  /**
   * 指定 cursor のページを取得して ComponentList に返す。
   *
   * Input:
   * - `input.cursor`: 取得対象ページの cursor（先頭ページは未指定）
   * - `input.limit`: 取得件数
   *
   * Output:
   * - `items`: 表示対象のEntry一覧
   * - `nextCursor`: 次ページ取得用 cursor
   * - `error`: 失敗時メッセージ
   */
  const fetchPage = useCallback(
    async ({
      cursor,
      limit,
    }: CursorPageFetchInput): Promise<
      CursorPageFetchResult<TimelineSkyshareEntry>
    > => {
      try {
        const params = cursor ? { limit, cursor } : { limit }
        const res = await getSkyshareEntries(params)

        if (res.status === 200) {
          return {
            items: res.data.entries ?? [],
            nextCursor: res.data.cursor,
          }
        }

        if (res.status === 401) {
          if (typeof window !== "undefined") {
            window.location.href = "/login"
          }
          return {
            items: [],
            error: "認証が必要です。",
          }
        }

        return {
          items: [],
          error: res.data.error ?? "Entry一覧の取得に失敗しました。",
        }
      } catch (err) {
        console.error("EntryList: failed to load entries", err)
        return {
          items: [],
          error: "Entry一覧の取得に失敗しました。",
        }
      }
    },
    [],
  )

  const controller = useCursorPaginationController<TimelineSkyshareEntry>({
    cursorPagination: {
      pageSize,
      fetchPage,
      loadingText: "読み込み中...",
      emptyText: "表示できるEntryはありません。",
    },
  })

  return (
    <section className={`${ui["base-card"]}`}>
      <div
        className={`${ui["toolbar"]} ${ui["toolbar-align"]} ${ui["toolbar-align-between"]}`}
      >
        <PageSizeSelect
          value={pageSize}
          onChange={next => {
            setPageSize(next)
            writePageSizeSetting(next)
          }}
          ariaLabel="表示件数"
        />
        <NavigationBar
          pagination={controller.pagination}
          ariaLabel="entry list pagination"
        />
      </div>

      {controller.loading || controller.error || controller.empty ? (
        <p
          className={
            controller.error ? styles["error-state"] : styles["empty-state"]
          }
        >
          {controller.message}
        </p>
      ) : (
        <ComponentList
          itemComponent={EntryCard}
          getItemKey={item => item.uri}
          getItemProps={item => ({
            onDeleted: () =>
              controller.removeItem(candidate => candidate.uri === item.uri),
            onSaved: (next: { heading: string; caption: string }) =>
              controller.updateItem(
                candidate => candidate.uri === item.uri,
                candidate => ({ ...candidate, ...next }),
              ),
          })}
          className={styles["entry-list"]}
          items={controller.items}
        />
      )}

      <NavigationBar
        pagination={controller.pagination}
        ariaLabel="entry list pagination"
      />
    </section>
  )
}

export default Component
