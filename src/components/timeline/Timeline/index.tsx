/**
 * 投稿一覧、投稿フォーム、投稿ランチャーをまとめる。
 * localStorage の設定はマウント後に読むため、SSR と初回クライアント描画の差による hydration mismatch を避ける。
 */

import { useT } from "@/components/i18n/useTranslation"
import { useCallback, useEffect, useRef, useState } from "react"
import { getEntries } from "@/client/openapi/client"
import ComponentList from "@/components/common/list/ComponentList"
import type {
  CursorPageFetchInput,
  CursorPageFetchResult,
} from "@/components/common/list/ComponentList"
import { useInfiniteScrollController } from "@/components/common/list/ComponentList"
import InfiniteScrollSentinel from "@/components/common/list/InfiniteScrollSentinel"
import ThreadCard from "@/components/timeline/Timeline/ThreadCard"
import ThreadComposer from "@/components/composer/ThreadComposer"
import PostLauncher from "@/components/timeline/Timeline/PostLauncher"
import SurveyGate from "@/components/timeline/Timeline/SurveyGate"
import {
  getActiveAccountInfo,
  getSessionOnce,
  isSessionKnownUnauthenticated,
} from "@/lib/session/activeAccountSession"
import { countHashtagUsage } from "@/lib/atproto/richtext"
import { getGuestDummyData } from "@/lib/timeline/guest"
import type { ThreadGroup } from "@/lib/timeline/posts"
import { isGuestModeRequested } from "@/lib/guestMode"
import {
  readHashtagHistory,
  seedHashtagHistoryFromRankedTags,
} from "@/lib/settings/hashtagHistorySettings"
import { readPinnedFormDisabledSetting } from "@/lib/settings/shareSettings"
import { readTimelineHiddenSetting } from "@/lib/settings/timelineSettings"
import ui from "@/styles/ui.module.css"
import styles from "./index.module.css"

type Props = {
  avatarUrl?: string | null
}

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
  const translator = useT()
  const { t } = translator
  // fetchPage の依存配列を空に保ち、言語変更による再生成・再取得で一覧とスクロール位置を失わない。
  const translatorRef = useRef(translator)
  translatorRef.current = translator
  const [reloadKey, setReloadKey] = useState(0)
  // 未認証かつ URL に ?guest がある場合だけ、ダミー投稿を表示する。
  const [guestMode, setGuestMode] = useState(false)
  // localStorage はサーバーにないため、SSR と同じ初期値で描画してから設定を読む。
  const [pinnedFormDisabled, setPinnedFormDisabled] = useState(false)
  useEffect(() => {
    setPinnedFormDisabled(readPinnedFormDisabledSetting(false))
  }, [])
  // 設定の読み込み前は一覧取得を止め、非表示設定で不要な API 呼び出しを起こさない。
  const [timelineHidden, setTimelineHidden] = useState<boolean | null>(null)
  useEffect(() => {
    setTimelineHidden(readTimelineHiddenSetting(false))
  }, [])
  // 一覧を隠す場合は投稿フォームを常に固定表示する。
  const showPinnedForm = !pinnedFormDisabled || timelineHidden === true
  const [resolvedAvatarUrl, setResolvedAvatarUrl] = useState<string | null>(
    avatarUrl ?? null,
  )
  // アカウント別のハッシュタグ履歴を扱うため、セッション解決までは未設定にする。
  const [resolvedDid, setResolvedDid] = useState<string | null>(null)

  useEffect(() => {
    setResolvedAvatarUrl(avatarUrl ?? null)
  }, [avatarUrl])

  // 一覧取得を待たずにアバターを得るため、共有セッション取得を使い getSession の重複取得を避ける。
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

  // 一覧を取得しない設定でも未認証を判定し、?guest ならデモ表示、それ以外はログインへ移動する。
  useEffect(() => {
    if (timelineHidden !== true) return
    let cancelled = false

    const checkSession = async () => {
      try {
        const res = await getSessionOnce()
        if (cancelled || res.status !== 401) return
        if (isGuestModeRequested()) {
          setGuestMode(true)
          return
        }
        window.location.href = "/login/"
      } catch (err) {
        console.error("Timeline: failed to check session", err)
      }
    }

    void checkSession()
    return () => {
      cancelled = true
    }
  }, [timelineHidden])

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
    }: CursorPageFetchInput): Promise<CursorPageFetchResult<ThreadGroup>> => {
      try {
        // 未認証が確定済みなら、ゲスト表示のために 401 になる一覧 API を再度呼ばない。
        if (isGuestModeRequested() && isSessionKnownUnauthenticated()) {
          setGuestMode(true)
          return { items: getGuestDummyData(translatorRef.current).threads }
        }

        const params = cursor ? { limit, cursor } : { limit }
        const res = await getEntries(params)

        if (res.status === 200) {
          const threads = res.data.threads ?? []

          // セッションにアバターがない場合は投稿データから補う。
          const nextAvatarUrl = threads
            .flatMap(thread => [thread.rootPost, ...thread.replies])
            .find(
              post =>
                typeof post.author?.avatar === "string" &&
                post.author.avatar !== "",
            )?.author.avatar
          if (nextAvatarUrl) {
            setResolvedAvatarUrl(nextAvatarUrl)
          }

          return {
            items: threads,
            nextCursor: res.data.cursor,
          }
        }

        if (res.status === 401) {
          if (isGuestModeRequested()) {
            setGuestMode(true)
            return { items: getGuestDummyData(translatorRef.current).threads }
          }
          if (typeof window !== "undefined") {
            window.location.href = "/login/"
          }
          return {
            items: [],
            error: translatorRef.current.t("error.unauthorized"),
          }
        }

        return {
          items: [],
          error: translatorRef.current.t("post.timeline.loadFailed"),
        }
      } catch (err) {
        console.error("Timeline: failed to load posts", err)
        return {
          items: [],
          error: translatorRef.current.t("post.timeline.loadFailed"),
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

  // ダミーデータの文言は表示言語に依存するため、言語変更時に差し替える。
  const guestReloadKey = guestMode
    ? `${reloadKey}:${translator.locale}`
    : reloadKey

  const infiniteController = useInfiniteScrollController<ThreadGroup>({
    infiniteScrollPagination: {
      fetchPage,
      reloadKey: guestReloadKey,
      enabled: timelineHidden === false,
      loadingText: t("common.loading"),
      emptyText: t("post.timeline.initializing"),
    },
  })

  const items = infiniteController.items
  const loading = infiniteController.loading
  const error = infiniteController.error
  const empty = infiniteController.empty
  const message = infiniteController.message
  const removeItem = infiniteController.removeItem

  // 履歴がある場合は高コストの投稿集計を省き、アカウント ID が解決するまで seed を待つ。
  const hashtagSeedRef = useRef(false)
  useEffect(() => {
    if (hashtagSeedRef.current) return
    if (loading || items.length === 0 || !resolvedDid) return
    hashtagSeedRef.current = true

    if (readHashtagHistory(resolvedDid).length > 0) return

    const ranked = countHashtagUsage(
      items
        .flatMap(thread => [thread.rootPost, ...thread.replies])
        .map(post => post.text),
    )
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
          {t("post.timeline.guestNotice")}
        </p>
      )}
      {showPinnedForm && (
        <div>
          <ThreadComposer
            variant="page"
            avatarUrl={resolvedAvatarUrl}
            accountDid={resolvedDid}
            onPosted={handlePosted}
            onPinnedFormDisabledChange={setPinnedFormDisabled}
            guestMode={guestMode}
          />
        </div>
      )}
      {!guestMode && <SurveyGate />}
      {timelineHidden !== true && (
        <PostLauncher
          avatarUrl={resolvedAvatarUrl}
          accountDid={resolvedDid}
          onPosted={handlePosted}
          onPinnedFormDisabledChange={setPinnedFormDisabled}
          guestMode={guestMode}
        />
      )}

      {timelineHidden === true ? null : loading || error || empty ? (
        <p className={error ? styles["error-state"] : styles["empty-state"]}>
          {message}
        </p>
      ) : (
        <ComponentList
          itemComponent={ThreadCard}
          getItemKey={group => group.rootPost.uri}
          getItemProps={group => ({
            group,
            onPostDeleted: removeItem,
            guestMode,
          })}
          className={styles["timeline-list"]}
          items={items}
        />
      )}

      {timelineHidden === true ? null : (
        <InfiniteScrollSentinel
          hasMore={infiniteController.hasMore}
          loadingMore={infiniteController.loadingMore}
          onLoadMore={infiniteController.loadMore}
          showEndMessage={!error && !empty}
          endText={t("common.listEnd")}
          ariaLabel={t("post.timeline.infiniteAria")}
        />
      )}
    </section>
  )
}

export default Component
