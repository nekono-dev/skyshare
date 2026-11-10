/**
 * facets（`app.bsky.richtext.facet` の配列）の形状を検証し、PDS に壊れたレコードを書き込まないようにする。
 *
 * - facets の意味（URL・メンション・ハッシュタグの検出、mention の DID 解決）はクライアントの責務で、サーバーは検証・解決しない。
 * - 検証するのは `index`（byteStart・byteEnd）が本文の UTF-8 バイト長に収まるかだけ。
 */
import type { BskyFacets } from "@/lib/atproto/recordTypes"

/**
 * facetsのindex(byteStart/byteEnd)が本文のUTF-8バイト長に収まっているかを検証する。
 *
 * 不正とみなす条件（1 件でもあればレコード全体を不正とする）:
 * - `byteStart >= byteEnd`（半開区間として空または逆転している）
 * - `byteEnd > 本文のバイト長`
 *
 * Input:
 * - `text`: 投稿本文(facetsのindexが参照する対象)
 * - `facets`: 検証対象のfacets配列(undefined/空配列は検証をスキップ)
 *
 * Output:
 * - void
 *
 * 失敗時の方針:
 * - 不正なfacetが見つかった場合はErrorをthrowする。呼び出し元でcatchして400を返す。
 *
 * 例:
 * - 入力: text="foo bar", facets=[{index:{byteStart:4,byteEnd:7}, features:[...]}]
 * - 出力: void(正常)
 * - 入力: text="foo", facets=[{index:{byteStart:0,byteEnd:10}, features:[...]}]
 * - 出力: throw Error("facet index out of range")
 */
export const validateFacets = (
    text: string,
    facets: BskyFacets | undefined,
): void => {
    if (!facets || facets.length === 0) return

    const byteLength = new TextEncoder().encode(text).length
    for (const facet of facets) {
        const { byteStart, byteEnd } = facet.index
        if (byteStart >= byteEnd || byteEnd > byteLength) {
            throw new Error("facet index out of range")
        }
    }
}
