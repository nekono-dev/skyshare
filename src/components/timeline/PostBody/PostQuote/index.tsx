/**
 * `app.bsky.embed.record` と `recordWithMedia` の引用部分を表示する。
 * - 外側のリンクと本文リンクを重ね、`<a>` の入れ子を避ける。
 * - 削除・ブロックされた引用元は案内だけを表示する。
 */
import { useFormat, useT } from "@/components/i18n/useTranslation"
import Avatar from "@/components/common/media/Avatar"
import ImageGallery from "@/components/image/ImageGallery"
import PostRichText from "@/components/timeline/PostRichText"
import type { PostQuote } from "@/lib/entry/postEmbedView"
import styles from "./index.module.css"

type Props = {
  quote: PostQuote
}

/**
 * 引用の枠を描画する。
 *
 * Input:
 * - `quote`: 埋め込みから取り出した引用
 *
 * Output:
 * - 引用元の内容を持つ枠。表示できない引用では案内文だけの枠
 *
 * 例:
 * - 入力: `{ kind: "unavailable" }`
 * - 出力: 「引用元の投稿は表示できません」の枠
 */
const Component = ({ quote }: Props) => {
  const { t } = useT()
  const { formatDateTime } = useFormat()

  if (quote.kind === "unavailable") {
    return (
      <div
        className={`${styles["quote"]} ${styles["unavailable"]}`}
        data-testid="post-quote"
      >
        {t("post.quote.unavailable")}
      </div>
    )
  }

  return (
    <div className={styles["quote"]} data-testid="post-quote">
      <a
        className={styles["overlay"]}
        href={quote.webUrl}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={t("post.quote.open")}
        title={t("post.quote.open")}
      />
      <div className={styles["author"]}>
        <Avatar
          src={quote.author.avatar}
          alt={quote.author.displayName ?? quote.author.handle}
          size="sm"
        />
        {quote.author.displayName ? (
          <strong className={styles["name"]}>{quote.author.displayName}</strong>
        ) : null}
        <span className={styles["handle"]}>@{quote.author.handle}</span>
        {quote.createdAt ? (
          <span className={styles["created-at"]}>
            {formatDateTime(quote.createdAt, { dateStyle: "medium" })}
          </span>
        ) : null}
      </div>
      {quote.text ? (
        <p className={styles["text"]}>
          <PostRichText text={quote.text} facets={quote.facets} />
        </p>
      ) : null}
      {quote.images.length > 0 ? (
        <ImageGallery images={quote.images} interactive={false} />
      ) : null}
    </div>
  )
}

export default Component
