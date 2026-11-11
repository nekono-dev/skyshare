/**
 * 投稿本文をリンク付きで表示する。
 * 外側の要素と改行の扱いは呼び出し側が担い、サーバー描画でもリンクを利用できる。
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
