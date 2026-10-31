/**
 * 汎用リスト整列コンポーネント。
 *
 * 責務と処理概要:
 * - `items` 配列を受け取り、各要素ごとに雛形コンポーネントを反復描画する。
 * - 無限スクロールの状態管理は `useInfiniteScrollController` に分離し、親がレイアウトを組み立てる。
 * - 1要素ごとの表示用 props は `getItemProps` で生成し、`item` 本体も併せて渡す。
 */
import { useT } from "@/components/i18n/useTranslation"
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ComponentType,
  type Key,
} from "react"
import styles from "./index.module.css"

type DefaultItemProps = Record<string, unknown>

/** 無限スクロール方式で1回に取得する件数（固定・変更不可）。 */
export const INFINITE_SCROLL_PAGE_SIZE = 50

type ItemComponentProps<TItem, TItemProps extends object> = TItemProps & {
  item: TItem
}

/**
 * cursor ページ取得関数へ渡す入力。
 *
 * 処理の趣旨:
 * - 先頭ページ取得時は `cursor` を省略し、2ページ目以降は `cursor` を付与する。
 * - `limit` は 1回の取得件数として必ず指定する。
 *
 * Input:
 * - `cursor`: 次ページ取得用 cursor（先頭ページは `undefined`）
 * - `limit`: 取得件数
 *
 * Output:
 * - fetch 処理に必要な最小入力
 *
 * 例:
 * - 入力: 先頭ページ
 * - 出力: `{ limit: 20 }`
 */
export type CursorPageFetchInput = {
  cursor?: string
  limit: number
}

/**
 * cursor ページ取得関数の戻り値。
 *
 * 処理の趣旨:
 * - `items` は常に配列で返す（空配列可）。
 * - `nextCursor` がなければ終端（EOR）とみなす。
 * - `error` がある場合は一覧表示せずエラー表示へ切り替える。
 *
 * Input:
 * - なし（fetch 結果オブジェクト）
 *
 * Output:
 * - ComponentList が次描画を決めるための結果
 *
 * 例:
 * - 成功: `{ items: posts, nextCursor: "abc" }`
 * - 終端: `{ items: posts }`
 * - 失敗: `{ items: [], error: "投稿一覧の取得に失敗しました。" }`
 */
export type CursorPageFetchResult<TItem> = {
  items: TItem[]
  nextCursor?: string
  error?: string
}

export type CursorPaginationViewModel = {
  hasPrevPage: boolean
  hasNextPage: boolean
  currentPage: number
  loading: boolean
  onPrev: () => void
  onNext: () => void
}

export type ComponentListProps<
  TItem,
  TItemProps extends object = DefaultItemProps,
> = {
  itemComponent: ComponentType<ItemComponentProps<TItem, TItemProps>>
  getItemProps?: (item: TItem, index: number) => TItemProps
  getItemKey?: (item: TItem, index: number) => Key
  className?: string
  items: TItem[]
}

/**
 * リスト要素の key を解決する。
 *
 * Input:
 * - `item`: リストの要素
 * - `index`: 配列内の位置
 * - `getItemKey`: 呼び出し側が指定した key 生成関数
 *
 * Output:
 * - 描画用の key 値
 *
 * 例:
 * - 入力: `{ id: "post-1" }`
 * - 出力: `"post-1"`
 */
const resolveItemKey = <TItem,>(
  item: TItem,
  index: number,
  getItemKey?: (item: TItem, index: number) => Key,
) => {
  if (getItemKey) {
    const customKey = getItemKey(item, index)
    if (customKey !== undefined && customKey !== null) {
      return customKey
    }
  }

  const maybeId = (item as { id?: Key }).id
  if (typeof maybeId === "string" || typeof maybeId === "number") {
    return maybeId
  }

  return index
}

/**
 * 無限スクロール方式のページング設定。
 *
 * 処理の趣旨:
 * - 取得したページを既存 `items` の末尾へ追記していく（置き換えない）。
 * - 1回の取得件数は `INFINITE_SCROLL_PAGE_SIZE` に固定され、呼び出し側は
 *   件数を指定できない。
 *
 * Input:
 * - `fetchPage`: API呼び出し等を行い、`CursorPageFetchResult` を返す関数
 * - `reloadKey`: 値が変わるたびに先頭へリセットして再取得するトリガー
 * - `enabled`: `false` の間は取得を行わない（未指定時は `true`）
 * - `loadingText`: 初回読み込み中の表示文言
 * - `emptyText`: 空一覧時文言
 * - `onError`: エラー表示時の副作用通知
 */
export type InfiniteScrollPaginationProps<TItem> = {
  fetchPage: (
    input: CursorPageFetchInput,
  ) => Promise<CursorPageFetchResult<TItem>>
  reloadKey?: string | number
  enabled?: boolean
  loadingText?: string
  emptyText?: string
  onError?: (message: string) => void
}

export type InfiniteScrollController<TItem> = {
  items: TItem[]
  loading: boolean
  loadingMore: boolean
  error?: string
  empty: boolean
  message?: string
  hasMore: boolean
  loadMore: () => void
  removeItem: (matchItem: (item: TItem) => boolean) => void
  updateItem: (
    matchItem: (item: TItem) => boolean,
    updater: (item: TItem) => TItem,
  ) => void
}

/**
 * 無限スクロール方式でリストを末尾に追記していくページング状態を管理する。
 *
 * Input:
 * - `infiniteScrollPagination`: ページ取得設定（fetchPage, reloadKey 等）
 *
 * Output:
 * - `items`（追記済み一覧）、`loadMore`（次ページ取得トリガー）などを含む controller
 *
 * 例:
 * - 入力: `useInfiniteScrollController({ infiniteScrollPagination: { fetchPage, enabled: true } })`
 * - 出力: `items`, `hasMore`, `loadMore` など
 */
export const useInfiniteScrollController = <TItem,>({
  infiniteScrollPagination,
}: {
  infiniteScrollPagination?: InfiniteScrollPaginationProps<TItem>
}): InfiniteScrollController<TItem> => {
  // 失敗時の文言を取得コールバック内で使うため、最新の翻訳関数を ref で保持する。
  // 依存配列に `t` を入れると言語切り替えのたびにコールバックが作り直され、
  // それを契機とする再取得で一覧・スクロール位置が失われるため。
  const { t } = useT()
  const tRef = useRef(t)
  tRef.current = t
  const [items, setItems] = useState<TItem[]>([])
  const [cursor, setCursor] = useState<string | undefined>(undefined)
  // 初回取得が完了するまでは次ページの有無が不明なため false とし、
  // InfiniteScrollSentinel が初回取得完了前から監視・追加取得を開始しないようにする。
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState("")
  const requestSeq = useRef(0)

  const fetchPage = infiniteScrollPagination?.fetchPage
  const onError = infiniteScrollPagination?.onError
  const reloadKey = infiniteScrollPagination?.reloadKey
  const enabled = infiniteScrollPagination?.enabled ?? true
  const loadingText = infiniteScrollPagination?.loadingText
  const emptyText = infiniteScrollPagination?.emptyText
  const isActive = Boolean(fetchPage) && enabled

  /**
   * 先頭ページを取得し直し、`items` を置き換える。
   */
  const loadFirstPage = useCallback(async () => {
    if (!fetchPage) {
      return
    }

    const requestId = ++requestSeq.current
    setLoading(true)
    setError("")

    try {
      const result = await fetchPage({ limit: INFINITE_SCROLL_PAGE_SIZE })

      if (requestId !== requestSeq.current) {
        return
      }

      if (result.error) {
        setError(result.error)
        setItems([])
        setCursor(undefined)
        setHasMore(false)
        onError?.(result.error)
        return
      }

      setItems(result.items)
      setCursor(result.nextCursor)
      setHasMore(Boolean(result.nextCursor))
    } catch (err) {
      if (requestId !== requestSeq.current) {
        return
      }

      console.error("ComponentList: failed to load infinite scroll page", err)
      const message = tRef.current("common.listLoadFailed")
      setError(message)
      setItems([])
      setCursor(undefined)
      setHasMore(false)
      onError?.(message)
    } finally {
      if (requestId === requestSeq.current) {
        setLoading(false)
      }
    }
  }, [fetchPage, onError])

  useEffect(() => {
    if (!isActive) {
      return
    }
    void loadFirstPage()
  }, [isActive, reloadKey, loadFirstPage])

  /**
   * 次ページを取得し、既存 `items` の末尾へ追記する。
   *
   * Output:
   * - `hasMore` が `true` かつ他の取得が進行中でない場合のみ取得する
   */
  const loadMore = useCallback(() => {
    if (!fetchPage || !isActive || !hasMore || loading || loadingMore) {
      return
    }

    const requestId = ++requestSeq.current
    setLoadingMore(true)
    setError("")

    void (async () => {
      try {
        const result = await fetchPage({
          cursor,
          limit: INFINITE_SCROLL_PAGE_SIZE,
        })

        if (requestId !== requestSeq.current) {
          return
        }

        if (result.error) {
          setError(result.error)
          onError?.(result.error)
          return
        }

        setItems(prev => [...prev, ...result.items])
        setCursor(result.nextCursor)
        setHasMore(Boolean(result.nextCursor))
      } catch (err) {
        if (requestId !== requestSeq.current) {
          return
        }

        console.error(
          "ComponentList: failed to load more infinite scroll items",
          err,
        )
        const message = tRef.current("common.listLoadFailed")
        setError(message)
        onError?.(message)
      } finally {
        if (requestId === requestSeq.current) {
          setLoadingMore(false)
        }
      }
    })()
  }, [fetchPage, isActive, hasMore, loading, loadingMore, cursor, onError])

  const removeItem = useCallback((matchItem: (item: TItem) => boolean) => {
    setItems(prev => prev.filter(item => !matchItem(item)))
  }, [])

  const updateItem = useCallback(
    (matchItem: (item: TItem) => boolean, updater: (item: TItem) => TItem) => {
      setItems(prev =>
        prev.map(item => (matchItem(item) ? updater(item) : item)),
      )
    },
    [],
  )

  const activeItems = isActive ? items : []

  const message = loading
    ? (loadingText ?? t("common.loading"))
    : error
      ? error
      : activeItems.length === 0
        ? (emptyText ?? t("common.listEmpty"))
        : undefined

  return {
    items: activeItems,
    loading,
    loadingMore,
    error: error || undefined,
    empty: activeItems.length === 0,
    message,
    hasMore: isActive && hasMore,
    loadMore,
    removeItem,
    updateItem,
  }
}

/**
 * リスト要素を縦方向に整列して描画する。
 *
 * Input:
 * - `itemComponent`: 1要素を描画する雛形コンポーネント
 * - `getItemProps`: 各要素から渡す props を生成する関数
 * - `getItemKey`: 各要素用の key を生成する関数
 * - `className`: 追加の className
 * - `items`: 表示対象の要素配列
 *
 * Output:
 * - 各要素が整列されたコンテナ
 *
 * 例:
 * - 入力: `items` と `PostContent`
 * - 出力: `PostContent` 一覧
 */
export const Component = <TItem, TItemProps extends object = DefaultItemProps>({
  itemComponent: ItemComponent,
  getItemProps,
  getItemKey,
  className,
  items,
}: ComponentListProps<TItem, TItemProps>) => {
  const containerClassName = className
    ? `${styles.container} ${className}`
    : styles.container

  return (
    <div className={containerClassName}>
      {items.map((item, index) => {
        const resolvedProps = getItemProps
          ? getItemProps(item, index)
          : ({} as TItemProps)

        return (
          <div
            key={resolveItemKey(item, index, getItemKey)}
            className={styles.item}
          >
            <ItemComponent item={item} {...resolvedProps} />
          </div>
        )
      })}
    </div>
  )
}

export default Component
