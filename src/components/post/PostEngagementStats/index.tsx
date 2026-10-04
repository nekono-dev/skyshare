/**
 * Bluesky 投稿のリアクション数（いいね・リポスト・リプライ・引用）を表示するコンポーネント。
 *
 * 責務と処理概要:
 * - 呼び出し元が Bluesky AppView（PostView）から取得済みの各カウントを props で受け取り、
 *   アイコン付きの数値として横並びで描画するだけの表示専用コンポーネント。
 * - アイコンは images 配下の SVG を CSS mask として描画し、件数が 1 以上の場合のみ
 *   アイコンと文字列を規定の青色（--color-bluesky）にする。
 * - Bluesky API の呼び出しや値の正規化は行わない（呼び出し元の責務）。
 */

import likeIcon from "@/images/reaction-like.svg"
import quoteIcon from "@/images/reaction-quote.svg"
import replyIcon from "@/images/reaction-reply.svg"
import repostIcon from "@/images/reaction-repost.svg"
import type { CSSProperties } from "react"
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
type StatItem = {
  icon: ImageMetadata
  count: number
  label: string
}

const Component = ({
  likeCount,
  repostCount,
  replyCount,
  quoteCount,
}: PostEngagementStatsProps) => {
  const items: StatItem[] = [
    { icon: likeIcon, count: likeCount, label: "いいね" },
    { icon: repostIcon, count: repostCount, label: "リポスト" },
    { icon: replyIcon, count: replyCount, label: "リプライ" },
    { icon: quoteIcon, count: quoteCount, label: "引用" },
  ]
  return (
    <dl className={styles["stats"]} aria-label="Blueskyでのリアクション数">
      {items.map(item => (
        <div
          key={item.label}
          className={`${styles["stat"]} ${item.count > 0 ? styles["active"] : ""}`}
        >
          <dt
            className={styles["icon"]}
            aria-hidden="true"
            style={{ "--icon-url": `url(${item.icon.src})` } as CSSProperties}
          />
          <dd className={styles["count"]}>{item.count}</dd>
          <span className={styles["label"]}>{item.label}</span>
        </div>
      ))}
    </dl>
  )
}

export default Component
