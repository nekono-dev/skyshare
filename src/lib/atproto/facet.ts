/**
 * facets(app.bsky.richtext.facet配列)の境界防御バリデーション。
 *
 * 責務と処理概要:
 * - facetsの組み立て(URL/メンション/ハッシュタグの検出、mentionのdid解決等)は
 *   クライアント側の責務であり、サーバはその意味的な正しさを検証・解決しない。
 * - ここで行うのはPDSへ壊れたレコードが書き込まれるのを防ぐための最小限の
 *   形状チェック(indexが本文のUTF-8バイト長に収まっているか)のみ。
 */
import type * as Components from "@/lib/api/schema/common"

/**
 * facetsのindex(byteStart/byteEnd)が本文のUTF-8バイト長に収まっているかを検証する。
 *
 * 想定する入力形状(最小要件):
 * - `facets`: `index: {byteStart, byteEnd}` を持つオブジェクトの配列(未指定可)
 *
 * 処理の趣旨:
 * - `byteStart < byteEnd`(半開区間として不正でない)かつ `byteEnd <= 本文バイト長` を
 *   満たさないfacetが1件でもあれば、レコード全体を不正として扱う。
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
    facets: Components.CommonFacetsType | undefined,
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
