/**
 * ページネーションUIを表示するナビゲーションバー。
 *
 * 責務と処理概要:
 * - 前後ページの表示と移動ボタン描画だけを担当する純粋UIコンポーネント。
 * - cursor や履歴などのデータ状態は保持せず、親から受け取った値で描画する。
 */
import type { CursorPaginationViewModel } from "@/components/common/ComponentList"
import ui from "@/styles/ui.module.css"
import styles from "./index.module.css"

export type NavigationBarProps = {
  pagination: CursorPaginationViewModel
  ariaLabel?: string
  className?: string
  prevLabel?: string
  nextLabel?: string
}

/**
 * 前後移動とページ番号表示を描画する。
 *
 * Input:
 * - `pagination`: ページング状態と遷移ハンドラ
 * - `ariaLabel`: nav 要素のアクセシビリティラベル
 * - `className`: 追加クラス
 * - `prevLabel`: 前へボタン文言
 * - `nextLabel`: 次へボタン文言
 *
 * Output:
 * - 条件に応じて前後ボタンとページ表示を含む nav
 *
 * 例:
 * - 入力: `{ pagination: { hasPrevPage: true, hasNextPage: false, currentPage: 3, ... } }`
 * - 出力: 「前へ」「ページ 3」を表示し「次へ」は非表示
 */
export const Component = ({
  pagination,
  ariaLabel,
  className,
  prevLabel,
  nextLabel,
}: NavigationBarProps) => {
  const { hasPrevPage, hasNextPage, currentPage, loading, onPrev, onNext } =
    pagination

  if (!hasPrevPage && !hasNextPage) {
    return null
  }

  const containerClassName = className
    ? `${styles.container} ${className}`
    : styles.container

  return (
    <nav
      className={containerClassName}
      aria-label={ariaLabel ?? "list pagination"}
    >
      {hasPrevPage ? (
        <button
          type="button"
          className={`${ui["base-button"]} ${ui["text-button"]} ${ui["white-button"]}`}
          onClick={onPrev}
          disabled={Boolean(loading)}
        >
          {prevLabel ?? "<<"}
        </button>
      ) : (
        <span
          className={`${ui["base-button"]} ${ui["text-button"]} ${styles.placeholder}`}
          aria-hidden="true"
        >
          {prevLabel ?? "<<"}
        </span>
      )}

      <span className={styles["page-status"]}>ページ {currentPage}</span>

      {hasNextPage ? (
        <button
          type="button"
          className={`${ui["base-button"]} ${ui["text-button"]} ${ui["white-button"]}`}
          onClick={onNext}
          disabled={Boolean(loading)}
        >
          {nextLabel ?? ">>"}
        </button>
      ) : (
        <span
          className={`${ui["base-button"]} ${ui["text-button"]} ${styles.placeholder}`}
          aria-hidden="true"
        >
          {nextLabel ?? ">>"}
        </span>
      )}
    </nav>
  )
}

export default Component
