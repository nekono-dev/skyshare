/**
 * 汎用リスト整列コンポーネント。
 *
 * 責務と処理概要:
 * - `items` 配列を受け取り、各要素ごとに雛形コンポーネントを反復描画する。
 * - ページング状態管理は `useCursorPaginationController` に分離し、親がレイアウトを組み立てる。
 * - 1要素ごとの表示用 props は `getItemProps` で生成し、`item` 本体も併せて渡す。
 */
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
type CursorToken = string | null
const DEFAULT_PAGE_SIZE = 20

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

/**
 * ComponentList の cursor ページング設定。
 *
 * 処理の趣旨:
 * - ページング状態（現在ページ・前後移動・BOR/EOR 判定）は ComponentList 側で管理する。
 * - 利用側は `fetchPage` 実装だけを提供し、`reloadKey` 変更で先頭再取得を指示する。
 *
 * Input:
 * - `pageSize`: 1ページ件数（未指定時は 20）
 * - `fetchPage`: API呼び出し等を行い、`CursorPageFetchResult` を返す関数
 * - `reloadKey`: 値が変わるたびに先頭ページを再取得するトリガー
 * - `ariaLabel`: ページャーのアクセシビリティラベル
 * - `loadingText`: 読み込み中表示文言
 * - `emptyText`: 空一覧時文言
 * - `onError`: エラー表示時の副作用通知
 *
 * Output:
 * - なし（ComponentList の挙動設定）
 *
 * 例:
 * - `cursorPagination={{ pageSize: 20, fetchPage, reloadKey }}`
 */
export type CursorPaginationProps<TItem> = {
  pageSize?: number
  fetchPage: (
    input: CursorPageFetchInput,
  ) => Promise<CursorPageFetchResult<TItem>>
  reloadKey?: string | number
  loadingText?: string
  emptyText?: string
  onError?: (message: string) => void
}

export type CursorPaginationViewModel = {
  hasPrevPage: boolean
  hasNextPage: boolean
  currentPage: number
  loading: boolean
  onPrev: () => void
  onNext: () => void
}

export type CursorPaginationController<TItem> = {
  items: TItem[]
  loading: boolean
  error?: string
  empty: boolean
  message?: string
  pagination: CursorPaginationViewModel
  removeItem: (matchItem: (item: TItem) => boolean) => void
  updateItem: (
    matchItem: (item: TItem) => boolean,
    updater: (item: TItem) => TItem,
  ) => void
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
 * cursor 指定を受けて API 呼び出しパラメータを組み立てる。
 *
 * Input:
 * - `cursor`: 次ページ取得用 cursor（先頭ページは `null`）
 * - `limit`: 1ページの最大件数
 *
 * Output:
 * - `fetchPage` に渡す入力オブジェクト
 *
 * 例:
 * - 入力: `cursor=null, limit=20`
 * - 出力: `{ limit: 20 }`
 */
const buildCursorQuery = (
  cursor: CursorToken,
  limit: number,
): CursorPageFetchInput => {
  if (cursor === null) {
    return { limit }
  }
  return { limit, cursor }
}

/**
 * リスト要素を縦方向に整列して描画する。
 *
 * Input:
 * - `itemComponent`: 1要素を描画する雛形コンポーネント
 * - `getItemProps`: 各要素から渡す props を生成する関数
 * - `getItemKey`: 各要素用の key を生成する関数
 * Input:
 * - `cursorPagination`: ページ取得設定（fetchPage, pageSize, reloadKey）
 *
 * Output:
 * - リスト表示と NavigationBar 表示を親が組み立てるための controller
 *
 * 例:
 * - 入力: `useCursorPaginationController({ fetchPage, reloadKey })`
 * - 出力: `items`, `loading`, `message`, `pagination.onNext` など
 */
export const useCursorPaginationController = <TItem,>({
  cursorPagination,
}: {
  cursorPagination?: CursorPaginationProps<TItem>
}): CursorPaginationController<TItem> => {
  const [pageItems, setPageItems] = useState<TItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [currentCursor, setCurrentCursor] = useState<CursorToken>(null)
  const [nextCursor, setNextCursor] = useState<string | undefined>(undefined)
  const [cursorHistory, setCursorHistory] = useState<CursorToken[]>([])
  const requestSeq = useRef(0)

  const fetchPage = cursorPagination?.fetchPage
  const onError = cursorPagination?.onError
  const reloadKey = cursorPagination?.reloadKey
  const loadingText = cursorPagination?.loadingText
  const emptyText = cursorPagination?.emptyText
  const isCursorMode = Boolean(fetchPage)
  const limit = cursorPagination?.pageSize ?? DEFAULT_PAGE_SIZE

  /**
   * 指定 cursor のページを取得し、ページング状態を更新する。
   *
   * Input:
   * - `cursor`: 取得対象ページの cursor（先頭ページは `null`）
   * - `history`: 戻る操作に使う cursor 履歴
   *
   * Output:
   * - state 更新のみ（返り値なし）
   *
   * 例:
   * - 入力: `cursor=null, history=[]`
   * - 出力: 先頭ページの要素と次ページ cursor を更新
   */
  const loadCursorPage = useCallback(
    async (cursor: CursorToken, history: CursorToken[]) => {
      if (!fetchPage) {
        return
      }

      const requestId = ++requestSeq.current
      setLoading(true)
      setError("")

      try {
        const result = await fetchPage(buildCursorQuery(cursor, limit))

        if (requestId !== requestSeq.current) {
          return
        }

        if (result.error) {
          setError(result.error)
          setPageItems([])
          setCurrentCursor(cursor)
          setCursorHistory(history)
          setNextCursor(undefined)
          onError?.(result.error)
          return
        }

        setPageItems(result.items)
        setCurrentCursor(cursor)
        setCursorHistory(history)
        setNextCursor(result.nextCursor)
      } catch (err) {
        if (requestId !== requestSeq.current) {
          return
        }

        console.error("ComponentList: failed to load cursor page", err)
        const message = "一覧の取得に失敗しました。"
        setError(message)
        setPageItems([])
        setCurrentCursor(cursor)
        setCursorHistory(history)
        setNextCursor(undefined)
        onError?.(message)
      } finally {
        if (requestId === requestSeq.current) {
          setLoading(false)
        }
      }
    },
    [fetchPage, limit, onError],
  )

  useEffect(() => {
    if (!isCursorMode) {
      return
    }
    void loadCursorPage(null, [])
  }, [isCursorMode, reloadKey, loadCursorPage])

  /**
   * 次ページへ遷移する。
   *
   * Output:
   * - `nextCursor` がある場合のみ次ページを取得する
   */
  const handleNextPage = () => {
    if (!nextCursor || loading) {
      return
    }
    const nextHistory = [...cursorHistory, currentCursor]
    void loadCursorPage(nextCursor, nextHistory)
  }

  /**
   * 前ページへ遷移する。
   *
   * Output:
   * - 履歴がある場合のみ前ページを取得する
   */
  const handlePrevPage = () => {
    if (cursorHistory.length === 0 || loading) {
      return
    }

    const prevCursor = cursorHistory[cursorHistory.length - 1]
    const nextHistory = cursorHistory.slice(0, -1)
    void loadCursorPage(prevCursor, nextHistory)
  }

  const hasPrevPage = cursorHistory.length > 0
  const hasNextPage = Boolean(nextCursor)
  const currentPage = cursorHistory.length + 1

  const items = isCursorMode ? pageItems : []

  /**
   * 指定条件に一致する1件を pageItems から取り除く（補充は行わない）。
   *
   * 処理の趣旨:
   * - nextCursor 等のページング状態はサーバーから取得済みの値をそのまま維持するため、
   *   このページの表示件数は一時的に減るだけで、前後ページ送りで取得できる
   *   要素一覧が抜けたり重複したりすることはない。
   *
   * Input:
   * - `matchItem`: 削除対象を判定する述語（例: `item => item.uri === deletedUri`）
   *
   * Output:
   * - なし（pageItems の state のみ更新する）
   *
   * 例:
   * - 入力: `removeItem(item => item.uri === "at://did:.../app.bsky.feed.post/abc")`
   * - 出力: 該当要素が一覧から消える（他の state は変化しない）
   */
  const removeItem = useCallback((matchItem: (item: TItem) => boolean) => {
    setPageItems(prev => prev.filter(item => !matchItem(item)))
  }, [])

  /**
   * 指定条件に一致する1件を pageItems 内で更新する（件数・順序は変化しない）。
   *
   * Input:
   * - `matchItem`: 更新対象を判定する述語（例: `item => item.uri === updatedUri`）
   * - `updater`: 一致した要素から次の状態を生成する関数
   *
   * Output:
   * - なし（pageItems の state のみ更新する）
   *
   * 例:
   * - 入力: `updateItem(item => item.uri === uri, item => ({ ...item, heading: "新見出し" }))`
   * - 出力: 該当要素の heading のみ更新される（他の state は変化しない）
   */
  const updateItem = useCallback(
    (matchItem: (item: TItem) => boolean, updater: (item: TItem) => TItem) => {
      setPageItems(prev =>
        prev.map(item => (matchItem(item) ? updater(item) : item)),
      )
    },
    [],
  )

  const message = loading
    ? (loadingText ?? "読み込み中…")
    : error
      ? error
      : items.length === 0
        ? (emptyText ?? "表示できる項目がありません。")
        : undefined

  return {
    items,
    loading,
    error: error || undefined,
    empty: items.length === 0,
    message,
    pagination: {
      hasPrevPage,
      hasNextPage,
      currentPage,
      loading,
      onPrev: handlePrevPage,
      onNext: handleNextPage,
    },
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
