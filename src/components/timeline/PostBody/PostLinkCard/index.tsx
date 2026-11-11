/**
 * `app.bsky.embed.external` のリンクカードを表示する。
 * 状態を持たず、サーバー描画でもリンクを利用できる。
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
