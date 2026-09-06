/**
 * 自分の投稿一覧と投稿ランチャーをまとめて扱うクライアントコンポーネント。
 *
 * 責務と処理概要:
 * - `/v2/entries` 取得処理を定義し、一覧コンポーネントへ提供する。
 * - PostForm の投稿成功時に再取得トリガーを更新する。
 * - ページング状態の管理は ComponentList 側へ委譲する。
 */

import { useCallback, useEffect, useRef, useState } from "react"
import { getEntries } from "@/client/openapi/client"
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
import PostCard from "@/components/post/PostCard"
import PostForm from "@/components/post/PostForm"
import PostLauncher from "@/components/post/PostLauncher"
import { getActiveAccountInfo } from "@/lib/account/activeAccountSession"
import { countHashtagUsage } from "@/lib/atproto/richtext"
import { GUEST_DUMMY_POSTS } from "@/lib/entry/guestDummyPosts"
import type { TimelinePost } from "@/lib/entry/posts"
import { isGuestModeRequested } from "@/lib/guestMode"
import {
  readHashtagHistory,
  seedHashtagHistoryFromRankedTags,
} from "@/lib/settings/hashtagHistorySettings"
import { readPinnedFormDisabledSetting } from "@/lib/settings/shareSettings"
import type { PaginationMode } from "@/lib/settings/timelineSettings"
import { readPageSizeSetting } from "@/lib/settings/timelineSettings"
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
  // 未ログイン(401)かつURLに`?guest`が付与されている場合のみ、ダミー投稿を表示する
  // ゲストモードへ切り替える（`@/lib/guestMode`参照）。ログイン済みユーザーには無関係。
  const [guestMode, setGuestMode] = useState(false)
  const [pageSize, setPageSize] = useState(() => readPageSizeSetting(PAGE_SIZE))
  // SSRは常にfalse（固定表示あり）でレンダリングするため、初期stateもfalse固定にし、
  // 実際の設定値はマウント後のuseEffectで反映する。ここをuseState(() =>
  // readPinnedFormDisabledSetting(false))のように初期化関数内でlocalStorageを
  // 読むと、クライアント初回レンダー（ハイドレーション）時点でSSR結果と異なる
  // 値になり得て、PostForm(固定表示)とPostLauncherのどちらを描画するかが
  // サーバー/クライアント間で食い違いhydration mismatchを起こす。
  const [pinnedFormDisabled, setPinnedFormDisabled] = useState(false)
  useEffect(() => {
    setPinnedFormDisabled(readPinnedFormDisabledSetting(false))
  }, [])
  // ページネーション方式の選択肢は廃止し、無限スクロールに固定した。
  // 下記の paged 用分岐（pagedController/PageSizeSelect/NavigationBar）は
  // 到達不能なデッドコードとして残置している。
  const paginationMode = "infinite" as PaginationMode
  const [resolvedAvatarUrl, setResolvedAvatarUrl] = useState<string | null>(
    avatarUrl ?? null,
  )
  // ハッシュタグ履歴（hashtagHistorySettings.ts）をアカウント別に分けるための識別子。
  // getSession解決前はnullのままとし、その間は履歴の読み書きをスキップさせる。
  const [resolvedDid, setResolvedDid] = useState<string | null>(null)

  useEffect(() => {
    setResolvedAvatarUrl(avatarUrl ?? null)
  }, [avatarUrl])

  // 投稿一覧（getEntries）の取得完了を待たずにアバターを表示するため、
  // AccountSwitcher/syncAccountAvatar と同じ取得処理(getActiveAccountInfo)を使い、
  // タイミングを揃えつつ getSession の二重取得を避ける。
  useEffect(() => {
    let cancelled = false

    const loadAvatarFromSession = async () => {
      try {
        const { avatarUrl: activeAvatarUrl, did } = await getActiveAccountInfo()
        if (cancelled) return
        if (activeAvatarUrl) {
          setResolvedAvatarUrl(activeAvatarUrl)
        }
        if (did) {
          setResolvedDid(did)
        }
      } catch (err) {
        console.error("Timeline: failed to load session for avatar", err)
      }
    }

    void loadAvatarFromSession()

    return () => {
      cancelled = true
    }
  }, [])

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
        const res = await getEntries(params)

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
          if (isGuestModeRequested()) {
            setGuestMode(true)
            return { items: GUEST_DUMMY_POSTS }
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

  const pagedController = useCursorPaginationController<TimelinePost>({
    cursorPagination: {
      pageSize,
      fetchPage,
      reloadKey,
      enabled: paginationMode === "paged",
      loadingText: "読み込み中...",
      emptyText: "初期化中...",
    },
  })

  const infiniteController = useInfiniteScrollController<TimelinePost>({
    infiniteScrollPagination: {
      fetchPage,
      reloadKey,
      enabled: paginationMode === "infinite",
      loadingText: "読み込み中...",
      emptyText: "初期化中...",
    },
  })

  const isPaged = paginationMode === "paged"
  const items = isPaged ? pagedController.items : infiniteController.items
  const loading = isPaged ? pagedController.loading : infiniteController.loading
  const error = isPaged ? pagedController.error : infiniteController.error
  const empty = isPaged ? pagedController.empty : infiniteController.empty
  const message = isPaged ? pagedController.message : infiniteController.message
  const removeItem = isPaged
    ? pagedController.removeItem
    : infiniteController.removeItem

  // Timeline初回読み込み完了後に一度だけ、ハッシュタグ候補の初回履歴seedを試みる。
  // 既にハッシュタグ履歴がある場合は seedHashtagHistoryFromRankedTags 側で書き込みが
  // スキップされるが、その判定を待たず readHashtagHistory で先に確認することで、
  // 履歴がある場合は countHashtagUsage の集計処理自体も行わないようにする。
  // resolvedDid が未解決のうちは履歴キーを特定できないため待機する。
  const hashtagSeedRef = useRef(false)
  useEffect(() => {
    if (hashtagSeedRef.current) return
    if (loading || items.length === 0 || !resolvedDid) return
    hashtagSeedRef.current = true

    if (readHashtagHistory(resolvedDid).length > 0) return

    const ranked = countHashtagUsage(items.map(post => post.text))
    seedHashtagHistoryFromRankedTags(
      ranked.map(r => r.tag),
      resolvedDid,
    )
  }, [items, loading, resolvedDid])

  return (
    <section>
      {guestMode && (
        <p
          className={`${ui["base-card"]} ${ui["base-padding"]} ${styles["guest-notice"]}`}
        >
          これはゲスト表示です。Blueskyへの投稿以外の動作を確認できます。
        </p>
      )}
      {!pinnedFormDisabled && (
        <div>
          <PostForm
            variant="page"
            avatarUrl={resolvedAvatarUrl}
            accountDid={resolvedDid}
            onPosted={handlePosted}
            onPinnedFormDisabledChange={setPinnedFormDisabled}
            guestMode={guestMode}
          />
        </div>
      )}
      <PostLauncher
        avatarUrl={resolvedAvatarUrl}
        accountDid={resolvedDid}
        onPosted={handlePosted}
        onPinnedFormDisabledChange={setPinnedFormDisabled}
        guestMode={guestMode}
      />

      {loading || error || empty ? (
        <p className={error ? styles["error-state"] : styles["empty-state"]}>
          {message}
        </p>
      ) : (
        <ComponentList
          itemComponent={PostCard}
          getItemKey={item => item.uri}
          getItemProps={item => ({
            onPostDeleted: () =>
              removeItem(candidate => candidate.uri === item.uri),
            guestMode,
          })}
          className={styles["timeline-list"]}
          items={items}
        />
      )}

      {isPaged ? (
        <NavigationBar
          pagination={pagedController.pagination}
          ariaLabel="post timeline pagination"
        />
      ) : (
        <InfiniteScrollSentinel
          hasMore={infiniteController.hasMore}
          loadingMore={infiniteController.loadingMore}
          onLoadMore={infiniteController.loadMore}
          showEndMessage={!error && !empty}
          endText="最初の投稿に到達しました"
          ariaLabel="post timeline infinite scroll"
        />
      )}
    </section>
  )
}

export default Component
