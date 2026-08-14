/**
 * 自分の投稿一覧と投稿ランチャーをまとめて扱うクライアントコンポーネント。
 *
 * 責務と処理概要:
 * - `/v2/entry` 取得処理を定義し、一覧コンポーネントへ提供する。
 * - PostForm の投稿成功時に再取得トリガーを更新する。
 * - ページング状態の管理は ComponentList 側へ委譲する。
 */

import { useCallback, useEffect, useState } from "react"
import { getEntry } from "@/client/openapi/client"
import ComponentList from "@/components/ComponentList"
import type {
  CursorPageFetchInput,
  CursorPageFetchResult,
} from "@/components/ComponentList"
import { useCursorPaginationController } from "@/components/ComponentList"
import NavigationBar from "@/components/NavigationBar"
import PageSizeSelect from "@/components/PageSizeSelect"
import PostCard from "@/components/PostCard"
import PostLauncher from "@/components/PostLauncher"
import type { TimelinePost } from "@/lib/posts"
import {
  readPageSizeSetting,
  writePageSizeSetting,
} from "@/lib/timelineSettings"
import ui from "@/styles/ui.module.css"
import styles from "./index.module.css"

type Props = {
  avatarUrl?: string | null
}

const PAGE_SIZE = 20

/**
 * 投稿一覧を読み込み、再取得を管理する。
 *
 * Input:
 * - `avatarUrl`: 投稿フォーム内の表示用アバター
 *
 * Output:
 * - 投稿ランチャーと一覧表示を含む UI
 */
const Component = ({ avatarUrl }: Props) => {
  const [reloadKey, setReloadKey] = useState(0)
  const [pageSize, setPageSize] = useState(() => readPageSizeSetting(PAGE_SIZE))
  const [resolvedAvatarUrl, setResolvedAvatarUrl] = useState<string | null>(
    avatarUrl ?? null,
  )

  useEffect(() => {
    setResolvedAvatarUrl(avatarUrl ?? null)
  }, [avatarUrl])

  /**
   * 指定 cursor のページを取得して ComponentList に返す。
   *
   * Input:
   * - `input.cursor`: 取得対象ページの cursor（先頭ページは未指定）
   * - `input.limit`: 取得件数
   *
   * Output:
   * - `items`: 表示対象の投稿一覧
   * - `nextCursor`: 次ページ取得用 cursor
   * - `error`: 失敗時メッセージ
   *
   * 例:
   * - 入力: `{ limit: 20 }`
   * - 出力: `{ items: [...], nextCursor: "..." }`
   */
  const fetchPage = useCallback(
    async ({
      cursor,
      limit,
    }: CursorPageFetchInput): Promise<CursorPageFetchResult<TimelinePost>> => {
      try {
        const params = cursor ? { limit, cursor } : { limit }
        const res = await getEntry(params)

        if (res.status === 200) {
          const posts = res.data.posts ?? []

          // APIレスポンスに含まれる自分の投稿からアバターURLを補完する。
          const nextAvatarUrl = posts.find(
            post =>
              typeof post.author?.avatar === "string" &&
              post.author.avatar !== "",
          )?.author.avatar
          if (nextAvatarUrl) {
            setResolvedAvatarUrl(nextAvatarUrl)
          }

          return {
            items: posts,
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
          error: res.data.error ?? "投稿一覧の取得に失敗しました。",
        }
      } catch (err) {
        console.error("Timeline: failed to load posts", err)
        return {
          items: [],
          error: "投稿一覧の取得に失敗しました。",
        }
      }
    },
    [],
  )

  /**
   * 投稿成功後に先頭ページ再取得をトリガーする。
   *
   * Output:
   * - `reloadKey` 更新により ComponentList が先頭ページを再読込する。
   */
  const handlePosted = () => {
    setReloadKey(prev => prev + 1)
  }

  const controller = useCursorPaginationController<TimelinePost>({
    cursorPagination: {
      pageSize,
      fetchPage,
      reloadKey,
      loadingText: "読み込み中...",
      emptyText: "初期化中...",
    },
  })

  return (
    <section className={`${ui.baseCard} ${ui.pageWidth}`}>
      <PostLauncher avatarUrl={resolvedAvatarUrl} onPosted={handlePosted} />

      <div
        className={`${ui.toolbar} ${ui.toolbarAlign} ${ui.toolbarAlignBetween}`}
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
          ariaLabel="post timeline pagination"
        />
      </div>

      {controller.loading || controller.error || controller.empty ? (
        <p className={controller.error ? styles.errorState : styles.emptyState}>
          {controller.message}
        </p>
      ) : (
        <ComponentList
          itemComponent={PostCard}
          getItemKey={item => item.uri}
          className={styles.timelineList}
          items={controller.items}
        />
      )}

      <NavigationBar
        pagination={controller.pagination}
        ariaLabel="post timeline pagination"
      />
    </section>
  )
}

export default Component
