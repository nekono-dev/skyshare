/**
 * 投稿本文の注釈（`app.bsky.richtext.facet`）を、表示・共有のために扱うユーティリティ。
 *
 * 責務と処理概要:
 * - 外部入力（PDS・AppViewのレコード）の facets を、表示に使う3種（mention/link/tag）だけの形へ正規化する。
 * - facets の UTF-8 バイト範囲で本文を区間に切り出し、リンクの区間にはリンク先を付ける（`.kiro/specs/post-rich-text`）。
 * - facets の無い部分に書かれた URL（スキーム省略・日本語に続くものを含む）とハッシュタグもリンクの区間にする。
 * - 指定した facets の範囲の文字を本文から取り除く（`.kiro/specs/link-card-priority`）。
 * - `@atproto/*` を import しない純粋関数のみで構成する（クライアントの bundle と cold start の負担を増やさないため）。
 */
import { findHashtagRanges, findUrlRanges } from "@/util/autoLink"

export type PostFacetFeature =
    | { $type: "app.bsky.richtext.facet#mention"; did: string }
    | { $type: "app.bsky.richtext.facet#link"; uri: string }
    | { $type: "app.bsky.richtext.facet#tag"; tag: string }

export type PostFacet = {
    index: { byteStart: number; byteEnd: number }
    features: PostFacetFeature[]
}

/** 本文の1区間。`href` があればリンクとして描画する */
export type RichTextSegment = { text: string; href?: string }

const encoder = new TextEncoder()
const decoder = new TextDecoder()

/**
 * facet の feature 1件を、既知の3種のいずれかへ正規化する。
 *
 * 想定する入力形状(最小要件):
 * - `{ $type: "app.bsky.richtext.facet#mention", did: string }` など、`$type` と対応する文字列の値を持つ
 *
 * Input:
 * - `feature`: 任意の値
 *
 * Output:
 * - 既知の feature なら正規化した値。未知・形の不正なら `undefined`
 */
const normalizeFeature = (feature: unknown): PostFacetFeature | undefined => {
    if (!feature || typeof feature !== "object") return undefined
    const value = feature as Record<string, unknown>
    switch (value.$type) {
        case "app.bsky.richtext.facet#mention":
            return typeof value.did === "string"
                ? { $type: value.$type, did: value.did }
                : undefined
        case "app.bsky.richtext.facet#link":
            return typeof value.uri === "string"
                ? { $type: value.$type, uri: value.uri }
                : undefined
        case "app.bsky.richtext.facet#tag":
            return typeof value.tag === "string"
                ? { $type: value.$type, tag: value.tag }
                : undefined
        default:
            return undefined
    }
}

/**
 * レコードの facets を、表示・共有に使う形へ正規化する。
 *
 * 想定する入力形状(最小要件):
 * - `[{ index: { byteStart: number, byteEnd: number }, features: [...] }, ...]`
 *
 * 処理の趣旨:
 * - 未知の feature を落とし、feature が1件も残らない facet・index が整数でない facet を除く。
 * - 範囲が本文に収まるかは本文が必要なため、ここでは見ない（`segmentRichText` が判定する）。
 *
 * Input:
 * - `input`: レコードの `facets`（未指定・不正な形も受け付ける）
 *
 * Output:
 * - 正規化した facets。配列でなければ空配列
 *
 * 例:
 * - 入力: `[{ index: { byteStart: 0, byteEnd: 4 }, features: [{ $type: "app.bsky.richtext.facet#tag", tag: "a" }] }]`
 * - 出力: 同じ内容の `PostFacet[]`
 */
export const normalizePostFacets = (input: unknown): PostFacet[] => {
    if (!Array.isArray(input)) return []
    const facets: PostFacet[] = []
    for (const item of input) {
        if (!item || typeof item !== "object") continue
        const { index, features } = item as {
            index?: { byteStart?: unknown; byteEnd?: unknown }
            features?: unknown
        }
        const byteStart = index?.byteStart
        const byteEnd = index?.byteEnd
        if (!Number.isInteger(byteStart) || !Number.isInteger(byteEnd)) continue
        if (!Array.isArray(features)) continue
        const normalized = features
            .map(feature => normalizeFeature(feature))
            .filter(
                (feature): feature is PostFacetFeature => feature !== undefined,
            )
        if (normalized.length === 0) continue
        facets.push({
            index: {
                byteStart: byteStart as number,
                byteEnd: byteEnd as number,
            },
            features: normalized,
        })
    }
    return facets
}

/**
 * feature からリンク先のURLを組み立てる。
 *
 * Input:
 * - `feature`: 正規化済みの feature
 *
 * Output:
 * - リンク先のURL。リンクにしない（http/https 以外のリンク）場合は `undefined`
 *
 * 例:
 * - 入力: `{ $type: "app.bsky.richtext.facet#tag", tag: "猫" }`
 * - 出力: `"https://bsky.app/hashtag/%E7%8C%AB"`
 */
const featureHref = (feature: PostFacetFeature): string | undefined => {
    switch (feature.$type) {
        case "app.bsky.richtext.facet#mention":
            return `https://bsky.app/profile/${feature.did}`
        case "app.bsky.richtext.facet#tag":
            return `https://bsky.app/hashtag/${encodeURIComponent(feature.tag)}`
        case "app.bsky.richtext.facet#link": {
            if (/^https?:\/\//i.test(feature.uri)) return feature.uri
            // スキームを省略した uri を書く投稿クライアントもあるため、ドメインで始まる
            // ものは https を補う。javascript: などの危険なスキームはリンクにしない
            return /^[a-z0-9-]+(\.[a-z0-9-]+)+([/?#]|$)/i.test(feature.uri)
                ? `https://${feature.uri}`
                : undefined
        }
    }
}

/**
 * バイト位置が UTF-8 の文字の境界かを判定する。
 * 継続バイト（`0b10xxxxxx`）の位置は文字の途中であるため境界ではない。
 */
const isCharBoundary = (bytes: Uint8Array, position: number) =>
    position === bytes.length || (bytes[position] & 0xc0) !== 0x80

/**
 * 本文の範囲として使える facet だけを、開始位置の順に並べて返す。
 *
 * 処理の趣旨:
 * - 範囲が空・本文の外にはみ出す・文字の途中で切れる facet を除く。
 * - 開始位置の順に見て、直前に採用した facet と重なる facet を除く（先に始まる方を残す）。
 *
 * Input:
 * - `bytes`: 本文の UTF-8 バイト列
 * - `facets`: 正規化済みの facets
 *
 * Output:
 * - 重なりの無い、範囲が正しい facets（開始位置の昇順）
 */
const validRanges = (bytes: Uint8Array, facets: PostFacet[]): PostFacet[] => {
    const sorted = facets
        .filter(facet => {
            const { byteStart, byteEnd } = facet.index
            return (
                byteStart >= 0 &&
                byteStart < byteEnd &&
                byteEnd <= bytes.length &&
                isCharBoundary(bytes, byteStart) &&
                isCharBoundary(bytes, byteEnd)
            )
        })
        .sort((a, b) => a.index.byteStart - b.index.byteStart)

    const result: PostFacet[] = []
    let lastEnd = 0
    for (const facet of sorted) {
        if (facet.index.byteStart < lastEnd) continue
        result.push(facet)
        lastEnd = facet.index.byteEnd
    }
    return result
}

/**
 * リンクでない文字の区間を、その中に書かれた URL の位置で更に区間に分ける。
 *
 * 処理の趣旨:
 * - facets を持たない投稿（他のクライアントの投稿や、日本語に続けて書いた URL など、
 *   投稿時に facets として検出されなかったもの）でも、URL をリンクにする。
 *
 * Input:
 * - `text`: リンクでない文字の区間の文字列
 *
 * Output:
 * - 区間の配列。連結すると `text` と一致する
 *
 * 例:
 * - 入力: `"見てexample.comです"`
 * - 出力: `[{ text: "見て" }, { text: "example.com", href: "https://example.com" }, { text: "です" }]`
 */
const autoLinkSegments = (text: string): RichTextSegment[] => {
    const urlRanges = findUrlRanges(text)
    // URL の範囲と重なるタグ（フラグメント等）は除き、URL を優先する
    const tagRanges = findHashtagRanges(text).filter(
        tag =>
            !urlRanges.some(url => tag.start < url.end && url.start < tag.end),
    )
    const ranges = [
        ...urlRanges,
        ...tagRanges.map(tag => ({
            start: tag.start,
            end: tag.end,
            href: `https://bsky.app/hashtag/${encodeURIComponent(tag.tag)}`,
        })),
    ].sort((a, b) => a.start - b.start)

    const segments: RichTextSegment[] = []
    let cursor = 0
    for (const range of ranges) {
        if (range.start > cursor) {
            segments.push({ text: text.slice(cursor, range.start) })
        }
        segments.push({
            text: text.slice(range.start, range.end),
            href: range.href,
        })
        cursor = range.end
    }
    if (cursor < text.length) segments.push({ text: text.slice(cursor) })
    return segments
}

/**
 * 本文を facets の範囲で区間に切り出し、リンクの区間にリンク先を付ける。
 *
 * 処理の趣旨:
 * - facets の index は UTF-8 のバイト位置のため、文字列（UTF-16）ではなくバイト列で切り出す。
 * - 不正な範囲の facet は無視し、その範囲は文字のまま残す（失敗時も本文は欠けない）。
 * - 1つの facet が複数の feature を持つ場合は、最初にリンク先を作れた feature を使う。
 * - facets の範囲外の文字の区間は、その中の URL を更にリンクの区間にする（`autoLinkSegments`）。
 *
 * Input:
 * - `text`: 投稿本文
 * - `facets`: 正規化済みの facets
 *
 * Output:
 * - 区間の配列。連結すると元の本文と一致する。本文が空なら空配列
 *
 * 例:
 * - 入力: `"hi #a"`, `[{ index: { byteStart: 3, byteEnd: 5 }, features: [{ $type: "...#tag", tag: "a" }] }]`
 * - 出力: `[{ text: "hi " }, { text: "#a", href: "https://bsky.app/hashtag/a" }]`
 */
export const segmentRichText = (
    text: string,
    facets: PostFacet[],
): RichTextSegment[] => {
    if (text.length === 0) return []
    const bytes = encoder.encode(text)
    const segments: RichTextSegment[] = []
    let cursor = 0

    for (const facet of validRanges(bytes, facets)) {
        const { byteStart, byteEnd } = facet.index
        const href = facet.features
            .map(feature => featureHref(feature))
            .find(value => value !== undefined)
        if (href === undefined) continue
        if (byteStart > cursor) {
            segments.push(
                ...autoLinkSegments(
                    decoder.decode(bytes.subarray(cursor, byteStart)),
                ),
            )
        }
        segments.push({
            text: decoder.decode(bytes.subarray(byteStart, byteEnd)),
            href,
        })
        cursor = byteEnd
    }

    if (cursor < bytes.length) {
        segments.push(
            ...autoLinkSegments(decoder.decode(bytes.subarray(cursor))),
        )
    }
    return segments
}

/**
 * 指定した facets の範囲の文字を本文から取り除く。
 *
 * 処理の趣旨:
 * - 取り除く範囲の判定は `segmentRichText` と同じ（不正な範囲の facet は無視して文字を残す）。
 * - 取り除いた後の空白の整形は呼び出し側の責務とする。
 *
 * Input:
 * - `text`: 投稿本文
 * - `facets`: 取り除く範囲を表す facets
 *
 * Output:
 * - 範囲の文字を除いた本文
 *
 * 例:
 * - 入力: `"see https://a.example now"`, `[{ index: { byteStart: 4, byteEnd: 21 }, ... }]`
 * - 出力: `"see  now"`
 */
export const removeFacetRanges = (
    text: string,
    facets: PostFacet[],
): string => {
    const bytes = encoder.encode(text)
    const parts: string[] = []
    let cursor = 0
    for (const facet of validRanges(bytes, facets)) {
        parts.push(
            decoder.decode(bytes.subarray(cursor, facet.index.byteStart)),
        )
        cursor = facet.index.byteEnd
    }
    parts.push(decoder.decode(bytes.subarray(cursor)))
    return parts.join("")
}

/**
 * facets のうち、URL（link）の feature を持つものだけを返す。
 *
 * Input:
 * - `facets`: 正規化済みの facets
 *
 * Output:
 * - link の feature を持つ facets
 */
export const filterLinkFacets = (facets: PostFacet[]): PostFacet[] =>
    facets.filter(facet =>
        facet.features.some(
            feature => feature.$type === "app.bsky.richtext.facet#link",
        ),
    )
