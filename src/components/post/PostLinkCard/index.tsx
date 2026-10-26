/**
 * 投稿の外部リンクの埋め込み（`app.bsky.embed.external`）を表示するカード（`.kiro/specs/entry-detail`）。
 *
 * 責務と処理概要:
 * - サムネイル・題名・説明・ドメインを並べ、カード全体をリンク先を新しいタブで開くリンクにする。
 * - 状態を持たない表示専用の部品で、サーバー描画だけでも表示とリンクが機能する。
 */
import type { PostLinkCard } from "@/lib/entry/postEmbedView"
import styles from "./index.module.css"

type Props = {
  card: PostLinkCard
}

/**
 * リンクカードを描画する。
 *
 * Input:
 * - `card`: 埋め込みから取り出したリンクカード
 *
 * Output:
 * - リンク先を新しいタブで開く `<a>` のカード
 *
 * 例:
 * - 入力: `{ uri: "https://example.com", title: "Example", description: "", domain: "example.com" }`
 * - 出力: 題名「Example」とドメイン「example.com」を持つカード
 */
const Component = ({ card }: Props) => {
  return (
    <a
      className={styles["card"]}
      href={card.uri}
      target="_blank"
      rel="noopener noreferrer"
      data-testid="post-link-card"
    >
      {card.thumb ? (
        <img
          className={styles["thumb"]}
          src={card.thumb}
          alt=""
          loading="lazy"
        />
      ) : null}
      <span className={styles["meta"]}>
        {card.title ? (
          <span className={styles["title"]}>{card.title}</span>
        ) : null}
        {card.description ? (
          <span className={styles["description"]}>{card.description}</span>
        ) : null}
        <span className={styles["domain"]}>{card.domain}</span>
      </span>
    </a>
  )
}

export default Component
