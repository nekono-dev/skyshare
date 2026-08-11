/**
 * 1件の Bluesky 投稿を表示するカード。
 *
 * 責務と処理概要:
 * - 投稿本文、作者情報、画像を 1 枚のカードにまとめて描画する。
 * - `skyshareEntry` が付与されている場合は、投稿に紐づく独自レコード情報も併記する。
 */

import ui from "@/styles/ui.module.css"
import styles from "./index.module.css"
import type { TimelinePost } from "@/lib/posts"

type PostCardProps = {
  item: TimelinePost
}

/**
 * 投稿カードを描画する。
 *
 * Input:
 * - `item`: 正規化済みの投稿一覧データ
 *
 * Output:
 * - 1件の投稿カード JSX
 *
 * 例:
 * - 入力: `item.text = "hello"`
 * - 出力: 投稿本文と作者情報を持つカード
 */
const Component = ({ item }: PostCardProps) => {
  const createdAtText = new Date(item.indexedAt).toLocaleString("ja-JP", {
    dateStyle: "medium",
    timeStyle: "short",
  })

  return (
    <article className={`${ui.baseCard} ${styles.card}`}>
      <header className={styles.header}>
        <div className={styles.authorBlock}>
          {item.author.avatar ? (
            <img
              className={styles.avatar}
              src={item.author.avatar}
              alt={item.author.displayName ?? item.author.handle}
              width={48}
              height={48}
              loading="lazy"
              decoding="async"
            />
          ) : (
            <div className={styles.avatarPlaceholder} aria-hidden="true" />
          )}

          <div>
            <div className={styles.authorNameRow}>
              <strong>{item.author.displayName ?? item.author.handle}</strong>
              <span className={styles.handle}>@{item.author.handle}</span>
            </div>
            <p className={styles.createdAt}>{createdAtText}</p>
          </div>
        </div>

        <a
          className={styles.link}
          href={item.url}
          target="_blank"
          rel="noopener noreferrer"
        >
          Bluesky で開く
        </a>
      </header>
      {item.text ?? <p className={styles.text}>{item.text}</p>}
      {item.images.length > 0 ? (
        <section className={styles.imageGrid} aria-label="post images">
          {item.images.map(image => (
            <figure key={image.url} className={styles.imageCard}>
              <img
                src={image.url}
                alt={image.alt}
                loading="lazy"
                decoding="async"
              />
              {image.alt ? <figcaption>{image.alt}</figcaption> : null}
            </figure>
          ))}
        </section>
      ) : null}
      {item.skyshareEntry ? (
        <section className={styles.skyshareEntry} aria-label="skyshare entry">
          <div className={styles.skyshareEntryHeader}>
            <span className={styles.skyshareBadge}>skyshare entry</span>
            <a
              className={styles.link}
              href={item.skyshareEntry.uri}
              target="_blank"
              rel="noopener noreferrer"
            >
              Entry を開く
            </a>
          </div>

          <dl className={styles.skyshareMeta}>
            <div>
              <dt>Heading</dt>
              <dd>{item.skyshareEntry.heading ?? "-"}</dd>
            </div>
            <div>
              <dt>Caption</dt>
              <dd>{item.skyshareEntry.caption ?? "-"}</dd>
            </div>
          </dl>

          {item.skyshareEntry.visualUrl ? (
            <img
              className={styles.skyshareVisual}
              src={item.skyshareEntry.visualUrl}
              alt={item.skyshareEntry.heading ?? "skyshare visual"}
              loading="lazy"
              decoding="async"
            />
          ) : null}
        </section>
      ) : (
        <p className={styles.noSkyshare}>skyshare entry はありません。</p>
      )}
    </article>
  )
}

export default Component
