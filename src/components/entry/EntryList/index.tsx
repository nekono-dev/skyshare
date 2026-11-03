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

import { useT } from "@/components/i18n/useTranslation"
import { useCallback, useRef, useState } from "react"
import { getSkyshareEntries } from "@/client/openapi/client"
import ComponentList from "@/components/common/list/ComponentList"
import type {
  CursorPageFetchInput,
  CursorPageFetchResult,
} from "@/components/common/list/ComponentList"
import { useInfiniteScrollController } from "@/components/common/list/ComponentList"
import InfiniteScrollSentinel from "@/components/common/list/InfiniteScrollSentinel"
import EntryCard from "@/components/entry/EntryList/EntryCard"
import { isSessionKnownUnauthenticated } from "@/lib/session/activeAccountSession"
import { getGuestDummyData } from "@/lib/timeline/guest"
import type { TimelineSkyshareEntry } from "@/lib/timeline/posts"
import { isGuestModeRequested } from "@/lib/guestMode"
import ui from "@/styles/ui.module.css"
import styles from "./index.module.css"

/**
 * Entry一覧を読み込み、ページングを管理する。
 *
 * Output:
 * - 一覧表示を含む UI
 */
const Component = () => {
  const translator = useT()
  const { t } = translator
  // fetchPage は依存配列を空にした useCallback のため、最新の翻訳関数を ref で参照する
  // （依存に `t` を入れると言語切り替えで再取得が走り、一覧が失われるため）。
  // 最新の翻訳関数（翻訳器）を保持する。
  const translatorRef = useRef(translator)
  translatorRef.current = translator
  // 未ログイン(401)かつURLに`?guest`が付与されている場合のみ、ダミーEntryを表示する
  // ゲストモードへ切り替える（`@/lib/guestMode`参照）。ログイン済みユーザーには無関係。
  const [guestMode, setGuestMode] = useState(false)

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
          return { items: getGuestDummyData(translatorRef.current).entries }
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
            return { items: getGuestDummyData(translatorRef.current).entries }
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
          error: translatorRef.current.t("entry.list.loadFailed"),
        }
      } catch (err) {
        console.error("EntryList: failed to load entries", err)
        return {
          items: [],
          error: translatorRef.current.t("entry.list.loadFailed"),
        }
      }
    },
    [],
  )

  // ゲスト表示のダミーデータは表示言語で文言が変わるため、言語が変わったら再取得して差し替える。
  const guestReloadKey = guestMode ? translator.locale : undefined

  const infiniteController = useInfiniteScrollController<TimelineSkyshareEntry>(
    {
      infiniteScrollPagination: {
        fetchPage,
        reloadKey: guestReloadKey,
        loadingText: t("common.loading"),
        emptyText: t("entry.list.empty"),
      },
    },
  )

  const items = infiniteController.items
  const loading = infiniteController.loading
  const error = infiniteController.error
  const empty = infiniteController.empty
  const message = infiniteController.message
  const removeItem = infiniteController.removeItem
  const updateItem = infiniteController.updateItem

  return (
    <section>
      {guestMode && (
        <p
          className={`${ui["base-card"]} ${ui["base-padding"]} ${styles["guest-notice"]}`}
        >
          {t("entry.list.guestNotice")}
        </p>
      )}
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

      <InfiniteScrollSentinel
        hasMore={infiniteController.hasMore}
        loadingMore={infiniteController.loadingMore}
        onLoadMore={infiniteController.loadMore}
        showEndMessage={!error && !empty}
        endText={t("entry.list.end")}
        ariaLabel={t("entry.list.infiniteAria")}
      />
    </section>
  )
}

export default Component
