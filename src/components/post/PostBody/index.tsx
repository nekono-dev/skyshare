import Avatar from "@/components/common/Avatar"
import ImageGallery from "@/components/image/ImageGallery"
import PostEngagementStats from "@/components/post/PostEngagementStats"
import type { SourceImage } from "@/lib/entry/entry"
import styles from "./index.module.css"

/**
 * 投稿カードの表示部（作者・日時・本文・画像・リアクション数）。
 *
 * 責務と処理概要:
 * - Timeline（`PostCard`）と Entry詳細ページの両方で使う、操作ロジックを持たない表示専用部品。
 * - カードの枠・背景は呼び出し側が持つ。
 * - 画像は本文の下に `ImageGallery` で表示し、`engagement` が渡された場合のみ画像の下にリアクション数を表示する。
 * - 設計: specs/postcardlayout/design.md §3.3
 */

type Props = {
  author: { handle: string; displayName?: string; avatar?: string }
  /** ISO文字列 */
  createdAt: string
  text: string
  images: SourceImage[]
  /** false の場合、画像を拡大表示できない静的な表示にする（既定 true） */
  imagesInteractive?: boolean
  /** 指定時は日時表示を Bluesky ページへのリンク（target=_blank）にする */
  postUrl?: string
  /** 指定時のみ画像の下に PostEngagementStats を表示する */
  engagement?: {
    likeCount: number
    repostCount: number
    replyCount: number
    quoteCount: number
  }
}

/**
 * 投稿の表示部を描画する。
 *
 * Input:
 * - 上記 `Props`
 *
 * Output:
 * - 作者ブロック・本文・画像・リアクション数を縦に並べた JSX
 */
const PostBody = ({
  author,
  createdAt,
  text,
  images,
  imagesInteractive = true,
  postUrl,
  engagement,
}: Props) => {
  const createdAtText = new Date(createdAt).toLocaleString("ja-JP", {
    dateStyle: "medium",
    timeStyle: "short",
  })

  return (
    <div className={styles.body}>
      <div className={styles["author-block"]}>
        <Avatar
          src={author.avatar}
          alt={author.displayName ?? author.handle}
          size="md"
        />

        <div className={styles["author-meta"]}>
          <div className={styles["author-name-row"]}>
            {author.displayName ? <strong>{author.displayName}</strong> : null}
            <span className={styles.handle}>@{author.handle}</span>
          </div>
          <p className={styles["created-at"]}>
            {postUrl ? (
              <a
                className={styles["created-at-link"]}
                href={postUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                {createdAtText}
              </a>
            ) : (
              createdAtText
            )}
          </p>
        </div>
      </div>

      {text ? <p className={styles.text}>{text}</p> : null}

      {images.length > 0 ? (
        <ImageGallery images={images} interactive={imagesInteractive} />
      ) : null}

      {engagement ? (
        <div className={styles.engagement}>
          <PostEngagementStats {...engagement} />
        </div>
      ) : null}
    </div>
  )
}

export default PostBody
