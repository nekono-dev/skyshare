/**
 * Bluesky レコードの形の型（atproto 側が持つ）。
 *
 * 責務と処理概要:
 * - 投稿レコードの組み立てと、その入力に使う形（facet・画像のメタ・OG・返信参照・動画の blob とメタ）を定める。
 * - API のスキーマ（`api/schema/common.ts`）の推論結果は、ここの型に代入可能であることを、api 側の型検査で確かめる。
 *   atproto は api を import しない（依存の向きは lib/api → lib/atproto の一方向）。
 *
 * 実装上の制約:
 * - 型だけを持つ。実行時の処理と import を持たない。
 */

/** facet のバイト範囲（UTF-8 バイト単位・開始を含み、終了を含まない）。 */
export type BskyFacetByteSlice = {
    byteStart: number
    byteEnd: number
}

/** facet の機能（メンション・リンク・ハッシュタグ）。 */
export type BskyFacetFeature =
    | { $type: "app.bsky.richtext.facet#mention"; did: string }
    | { $type: "app.bsky.richtext.facet#link"; uri: string }
    | { $type: "app.bsky.richtext.facet#tag"; tag: string }

/** 本文の注釈（facet）1 件。 */
export type BskyFacet = {
    $type?: "app.bsky.richtext.facet"
    index: BskyFacetByteSlice
    features: BskyFacetFeature[]
}

/** 投稿の facets。 */
export type BskyFacets = BskyFacet[]

/** 画像の代替テキストつきのメタ（1 枚ごと）。 */
export type BskyImagesMeta = Array<{
    width: number
    height: number
    alt: string
}>

/** OGP の情報（外部リンクのカードに使う）。 */
export type BskyOgMeta = {
    title: string
    description: string
    image?: string
    url: string
}

/** 強参照（レコードの URI と CID の組）。 */
export type BskyStrongRef = {
    uri: string
    cid: string
}

/** 返信の参照（スレッドの起点と直前の投稿）。 */
export type BskyReplyRef = {
    root: BskyStrongRef
    parent: BskyStrongRef
}

/** 動画の blob 参照（動画サービスが返す JSON 形式）。 */
export type BskyVideoBlob = {
    $type: "blob"
    ref: { $link: string }
    mimeType: string
    size: number
}

/** 動画のメタ（縦横と代替テキスト）。 */
export type BskyVideoMeta = {
    width: number
    height: number
    alt: string
}
