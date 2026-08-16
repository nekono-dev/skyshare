import { useEffect, useRef } from "react"
import Loading from "@/components/Loading"
import styles from "./index.module.css"

/**
 * 無限スクロール方式の末尾トリガーを表示する。
 *
 * 責務と処理概要:
 * - `NavigationBar` の無限スクロール版に相当する純粋UI。
 * - 自身がビューポートに近づいたことを `IntersectionObserver` で検知し、
 *   `onLoadMore` を呼び出すだけで、取得ロジックやページング状態は保持しない。
 */

export type InfiniteScrollSentinelProps = {
  hasMore: boolean
  loadingMore: boolean
  onLoadMore: () => void
  loadingText?: string
  ariaLabel?: string
  className?: string
}

/**
 * 末尾監視用の sentinel 要素を描画する。
 *
 * Input:
 * - `hasMore`: 次ページが存在するか（`false` なら何も描画しない）
 * - `loadingMore`: 追記取得中かどうか
 * - `onLoadMore`: sentinel がビューポートに近づいた際に呼ぶコールバック
 * - `loadingText`: 取得中表示文言
 * - `ariaLabel`: sentinel 要素のアクセシビリティラベル
 * - `className`: 追加の className
 *
 * Output:
 * - `hasMore` が `true` の間だけ表示される sentinel 要素
 *
 * 例:
 * - 入力: `{ hasMore: true, loadingMore: false, onLoadMore: fn }`
 * - 出力: ビューポートに近づくと `onLoadMore` が呼ばれる不可視の監視要素
 */
export const Component = ({
  hasMore,
  loadingMore,
  onLoadMore,
  loadingText,
  ariaLabel,
  className,
}: InfiniteScrollSentinelProps) => {
  const sentinelRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!hasMore) {
      return
    }

    const target = sentinelRef.current
    if (!target) {
      return
    }

    const observer = new IntersectionObserver(
      entries => {
        if (entries.some(entry => entry.isIntersecting)) {
          onLoadMore()
        }
      },
      { rootMargin: "300px 0px" },
    )

    observer.observe(target)

    return () => {
      observer.disconnect()
    }
  }, [hasMore, onLoadMore])

  if (!hasMore) {
    return null
  }

  const containerClassName = className
    ? `${styles.container} ${className}`
    : styles.container

  return (
    <div
      ref={sentinelRef}
      className={containerClassName}
      role="status"
      aria-label={ariaLabel ?? "loading more items"}
      aria-live="polite"
    >
      {loadingMore ? (
        <Loading message={loadingText ?? "読み込み中..."} />
      ) : null}
    </div>
  )
}

export default Component
