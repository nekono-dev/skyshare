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
import ComponentList from "@/components/common/ComponentList"
import type {
  CursorPageFetchInput,
  CursorPageFetchResult,
} from "@/components/common/ComponentList"
import {
  useCursorPaginationController,
  useInfiniteScrollController,
} from "@/components/common/ComponentList"
import InfiniteScrollSentinel from "@/components/common/InfiniteScrollSentinel"
import NavigationBar from "@/components/common/NavigationBar"
import PageSizeSelect from "@/components/common/PageSizeSelect"
import EntryCard from "@/components/entry/EntryCard"
import { isSessionKnownUnauthenticated } from "@/lib/account/activeAccountSession"
import { GUEST_DUMMY_ENTRIES } from "@/lib/entry/guestDummyPosts"
import type { TimelineSkyshareEntry } from "@/lib/entry/posts"
import { isGuestModeRequested } from "@/lib/guestMode"
import type { PaginationMode } from "@/lib/settings/timelineSettings"
import {
  readPageSizeSetting,
  writePageSizeSetting,
} from "@/lib/settings/timelineSettings"
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
  // 未ログイン(401)かつURLに`?guest`が付与されている場合のみ、ダミーEntryを表示する
  // ゲストモードへ切り替える（`@/lib/guestMode`参照）。ログイン済みユーザーには無関係。
  const [guestMode, setGuestMode] = useState(false)
  // ページネーション方式の選択肢は廃止し、無限スクロールに固定した。
  // 下記の paged 用分岐（pagedController/PageSizeSelect/NavigationBar）は
  // 到達不能なデッドコードとして残置している。
  const paginationMode = "infinite" as PaginationMode

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
        // 直近で未ログインと判明済み（`activeAccountSession.ts`参照）かつゲスト表示要求時は、
        // 401確定済みの`getSkyshareEntries`をわざわざ叩き直さずゲスト表示へ直行する。
        if (isGuestModeRequested() && isSessionKnownUnauthenticated()) {
          setGuestMode(true)
          return { items: GUEST_DUMMY_ENTRIES }
        }

        const params = cursor ? { limit, cursor } : { limit }
        const res = await getSkyshareEntries(params)

        if (res.status === 200) {
          return {
            items: res.data.entries ?? [],
            nextCursor: res.data.cursor,
          }
        }

        if (res.status === 401) {
          if (isGuestModeRequested()) {
            setGuestMode(true)
            return { items: GUEST_DUMMY_ENTRIES }
          }
          if (typeof window !== "undefined") {
            window.location.href = "/login/"
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

  const pagedController = useCursorPaginationController<TimelineSkyshareEntry>({
    cursorPagination: {
      pageSize,
      fetchPage,
      enabled: paginationMode === "paged",
      loadingText: "読み込み中...",
      emptyText: "表示できるEntryはありません。",
    },
  })

  const infiniteController = useInfiniteScrollController<TimelineSkyshareEntry>(
    {
      infiniteScrollPagination: {
        fetchPage,
        enabled: paginationMode === "infinite",
        loadingText: "読み込み中...",
        emptyText: "表示できるEntryはありません。",
      },
    },
  )

  const isPaged = paginationMode === "paged"
  const items = isPaged ? pagedController.items : infiniteController.items
  const loading = isPaged ? pagedController.loading : infiniteController.loading
  const error = isPaged ? pagedController.error : infiniteController.error
  const empty = isPaged ? pagedController.empty : infiniteController.empty
  const message = isPaged ? pagedController.message : infiniteController.message
  const removeItem = isPaged
    ? pagedController.removeItem
    : infiniteController.removeItem
  const updateItem = isPaged
    ? pagedController.updateItem
    : infiniteController.updateItem

  return (
    <section>
      {guestMode && (
        <p
          className={`${ui["base-card"]} ${ui["base-padding"]} ${styles["guest-notice"]}`}
        >
          これはログイン不要のゲスト表示です。実際のEntryの編集・削除はできません。
        </p>
      )}
      <div
        className={`${ui["base-component"]} ${ui["toolbar"]} ${ui["toolbar-align"]} ${ui["toolbar-align-between"]}`}
      >
        {isPaged ? (
          <PageSizeSelect
            value={pageSize}
            onChange={next => {
              setPageSize(next)
              writePageSizeSetting(next)
            }}
            ariaLabel="表示件数"
          />
        ) : (
          <span aria-hidden="true" />
        )}
        {isPaged ? (
          <NavigationBar
            pagination={pagedController.pagination}
            ariaLabel="entry list pagination"
          />
        ) : null}
      </div>

      {loading || error || empty ? (
        <p className={error ? styles["error-state"] : styles["empty-state"]}>
          {message}
        </p>
      ) : (
        <ComponentList
          itemComponent={EntryCard}
          getItemKey={item => item.uri}
          getItemProps={item => ({
            onDeleted: () =>
              removeItem(candidate => candidate.uri === item.uri),
            onSaved: (next: { heading: string; caption: string }) =>
              updateItem(
                candidate => candidate.uri === item.uri,
                candidate => ({ ...candidate, ...next }),
              ),
            guestMode,
          })}
          className={styles["entry-list"]}
          items={items}
        />
      )}

      {isPaged ? (
        <NavigationBar
          pagination={pagedController.pagination}
          ariaLabel="entry list pagination"
        />
      ) : (
        <InfiniteScrollSentinel
          hasMore={infiniteController.hasMore}
          loadingMore={infiniteController.loadingMore}
          onLoadMore={infiniteController.loadMore}
          showEndMessage={!error && !empty}
          endText="最初のEntryに到達しました"
          ariaLabel="entry list infinite scroll"
        />
      )}
    </section>
  )
}

export default Component
