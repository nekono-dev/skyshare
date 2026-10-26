/**
 * 投稿本文を、メンション・ハッシュタグ・URLをリンクにして描画する部品（`.kiro/specs/post-rich-text`）。
 *
 * 責務と処理概要:
 * - 本文を facets の範囲で区間に切り出し（`segmentRichText`）、リンクの区間を新しいタブで開く `<a>` にする。
 * - リンク以外の区間は文字のまま描画する。外側の要素（`<p>` 等）と改行の扱いは呼び出し側が持つ。
 * - 状態を持たないため、サーバー描画だけでもリンクが表示される（JavaScript の実行を要しない）。
 */
import { Fragment } from "react"
import { segmentRichText, type PostFacet } from "@/lib/atproto/richTextSegments"
import styles from "./index.module.css"

type Props = {
  text: string
  /** 本文の facets。未指定・空なら本文をそのまま描画する */
  facets?: PostFacet[]
}

/**
 * 本文をリンク付きで描画する。
 *
 * Input:
 * - `text`: 投稿本文
 * - `facets`: 本文の facets
 *
 * Output:
 * - リンクと文字の並び（Fragment）
 *
 * 例:
 * - 入力: `text="hi #a"`, `facets=[tag 3-5]`
 * - 出力: `hi <a href="https://bsky.app/hashtag/a">#a</a>`
 */
const Component = ({ text, facets = [] }: Props) => {
  const segments = segmentRichText(text, facets)
  return (
    <>
      {segments.map((segment, index) =>
        segment.href ? (
          <a
            key={index}
            className={styles["link"]}
            href={segment.href}
            target="_blank"
            rel="noopener noreferrer"
          >
            {segment.text}
          </a>
        ) : (
          <Fragment key={index}>{segment.text}</Fragment>
        ),
      )}
    </>
  )
}

export default Component
