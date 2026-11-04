/**
 * ゲスト表示の本文の中の文字列から、リンクの範囲（UTF-8 のバイト範囲）を求める。
 *
 * 処理の趣旨:
 * - 翻訳後の本文に対して、リンクにしたい文字列の位置を探して facets を組み立てる。
 * - `postsBasic.ts` だけが使う。ダミーデータ自体は含まない。
 */
import type {
    PostFacet,
    PostFacetFeature,
} from "@/lib/atproto/richTextSegments"

/**
 * 翻訳後の本文の中の文字列の位置から、facets（UTF-8 のバイト範囲）を組み立てる。
 *
 * 処理の趣旨:
 * - ゲスト表示の本文は表示言語ごとに異なるため、固定のバイト位置を書かずに、
 *   リンクにしたい文字列を本文から探して範囲を求める（`specs/post-rich-text`）。
 *
 * Input:
 * - `text`: 翻訳後の本文
 * - `parts`: リンクにする文字列と、その feature の組
 *
 * Output:
 * - 見つかった文字列の facets（本文に無い文字列は含めない）
 *
 * 例:
 * - 入力: `"見て #a"`, `[{ match: "#a", feature: { $type: "app.bsky.richtext.facet#tag", tag: "a" } }]`
 * - 出力: `[{ index: { byteStart: 7, byteEnd: 9 }, features: [...] }]`
 */
export const buildGuestFacets = (
    text: string,
    parts: { match: string; feature: PostFacetFeature }[],
): PostFacet[] => {
    const encoder = new TextEncoder()
    return parts.flatMap(({ match, feature }) => {
        const position = text.indexOf(match)
        if (position < 0) return []
        const byteStart = encoder.encode(text.slice(0, position)).length
        return [
            {
                index: {
                    byteStart,
                    byteEnd: byteStart + encoder.encode(match).length,
                },
                features: [feature],
            },
        ]
    })
}
