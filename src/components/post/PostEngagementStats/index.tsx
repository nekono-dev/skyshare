/**
 * Bluesky 投稿のリアクション数（いいね・リポスト・リプライ・引用）を表示するコンポーネント。
 *
 * 責務と処理概要:
 * - 呼び出し元が Bluesky AppView（PostView）から取得済みの各カウントを props で受け取り、
 *   アイコン付きの数値として横並びで描画するだけの表示専用コンポーネント。
 * - Bluesky API の呼び出しや値の正規化は行わない（呼び出し元の責務）。
 */

import styles from "./index.module.css"

type PostEngagementStatsProps = {
  likeCount: number
  repostCount: number
  replyCount: number
  quoteCount: number
}

/**
 * リアクション数の一覧を描画する。
 *
 * Input:
 * - `likeCount` / `repostCount` / `replyCount` / `quoteCount`: 各リアクションの件数
 *
 * Output:
 * - アイコン+数値を横並びにした JSX
 *
 * 例:
 * - 入力: `{ likeCount: 12, repostCount: 3, replyCount: 1, quoteCount: 0 }`
 * - 出力: ハート/repost/吹き出し/引用符アイコンと数値 4 組を並べた一覧
 */
const Component = ({
  likeCount,
  repostCount,
  replyCount,
  quoteCount,
}: PostEngagementStatsProps) => {
  return (
    <dl className={styles.stats} aria-label="Blueskyでのリアクション数">
      <div className={styles.stat}>
        <dt className={styles.icon} aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 21s-7.5-4.35-10-9.03C.6 8.36 2.4 5 6 5c2.06 0 3.53 1.06 4.5 2.4C11.47 6.06 12.94 5 15 5c3.6 0 5.4 3.36 4 6.97C19.5 16.65 12 21 12 21z" />
          </svg>
        </dt>
        <dd className={styles.count}>{likeCount}</dd>
        <span className={styles.label}>いいね</span>
      </div>

      <div className={styles.stat}>
        <dt className={styles.icon} aria-hidden="true">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              d="M4 7h13l-3-3M20 17H7l3 3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </dt>
        <dd className={styles.count}>{repostCount}</dd>
        <span className={styles.label}>リポスト</span>
      </div>

      <div className={styles.stat}>
        <dt className={styles.icon} aria-hidden="true">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              d="M4 5h16v11H8l-4 4V5z"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </dt>
        <dd className={styles.count}>{replyCount}</dd>
        <span className={styles.label}>リプライ</span>
      </div>

      <div className={styles.stat}>
        <dt className={styles.icon} aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M7 6c-2.76 0-5 2.24-5 5 0 2.42 1.72 4.44 4 4.9V19l3.5-3H9c-.34 0-.66-.03-.97-.1C9.24 15.14 10 13.66 10 12v-1c0-2.76-1.34-5-3-5zm10 0c-2.76 0-5 2.24-5 5 0 2.42 1.72 4.44 4 4.9V19l3.5-3H19c-.34 0-.66-.03-.97-.1C19.24 15.14 20 13.66 20 12v-1c0-2.76-1.34-5-3-5z" />
          </svg>
        </dt>
        <dd className={styles.count}>{quoteCount}</dd>
        <span className={styles.label}>引用</span>
      </div>
    </dl>
  )
}

export default Component
