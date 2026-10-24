/**
 * 投稿の埋め込み（AppView が hydrate した `PostView.embed`）から、entry詳細ページに表示する
 * リンクカードと引用を取り出すモジュール（`specs/entry-detail`）。
 *
 * 責務と処理概要:
 * - `app.bsky.embed.external#view` からリンクカードを取り出す（http/https のリンク先に限る）。
 * - `app.bsky.embed.record#view`・`app.bsky.embed.recordWithMedia#view` から引用を取り出す。
 *   引用元が削除・ブロック・切り離しの場合は「表示できない」として返し、フィード・リスト等の
 *   投稿以外の引用は表示しない。
 * - 画像・動画（recordWithMedia の media を含む）は既存の抽出（`@/lib/entry/entry`）の責務とし、ここでは扱わない。
 * - 外部入力を扱うため、`@atproto/*` の型に頼らず `$type` と値の型を確かめる純粋関数で構成する。
 */
import type { SourceImage } from "@/lib/entry/entry"
import { bskyPostUrlgen, parseAtUri } from "@/lib/entry/url"
import {
    normalizePostFacets,
    type PostFacet,
} from "@/lib/atproto/richTextSegments"

export type PostLinkCard = {
    uri: string
    title: string
    description: string
    /** リンク先のホスト名（表示用） */
    domain: string
    /** サムネイルのURL（AppView の CDN）。無ければ `undefined` */
    thumb?: string
}

export type PostQuote =
    | {
          kind: "post"
          /** 引用元の Bluesky の投稿ページのURL */
          webUrl: string
          author: { handle: string; displayName?: string; avatar?: string }
          /** ISO文字列 */
          createdAt: string
          text: string
          facets: PostFacet[]
          images: SourceImage[]
      }
    | { kind: "unavailable" }

export type PostEmbedView = {
    linkCard?: PostLinkCard
    quote?: PostQuote
}

type UnknownRecord = Record<string, unknown>

const asRecord = (value: unknown): UnknownRecord | undefined =>
    value && typeof value === "object" ? (value as UnknownRecord) : undefined

const asString = (value: unknown): string | undefined =>
    typeof value === "string" ? value : undefined

/**
 * `app.bsky.embed.external#view` の `external` からリンクカードを組み立てる。
 *
 * 想定する入力形状(最小要件):
 * - `{ uri: string, title?: string, description?: string, thumb?: string }`
 *
 * Input:
 * - `external`: view の `external`
 *
 * Output:
 * - リンクカード。uri が http/https の URL として解釈できなければ `undefined`
 */
const toLinkCard = (external: unknown): PostLinkCard | undefined => {
    const value = asRecord(external)
    const uri = asString(value?.uri)
    if (!uri || !/^https?:\/\//i.test(uri)) return undefined
    let domain: string
    try {
        domain = new URL(uri).hostname
    } catch {
        return undefined
    }
    const thumb = asString(value?.thumb)
    return {
        uri,
        title: asString(value?.title) ?? "",
        description: asString(value?.description) ?? "",
        domain,
        ...(thumb ? { thumb } : {}),
    }
}

/**
 * 引用元の投稿の `embeds`（view の配列）から、枠に添える画像を取り出す。
 *
 * 想定する入力形状(最小要件):
 * - `[{ $type: "app.bsky.embed.images#view", images: [{ thumb: string, alt?: string, aspectRatio? }] }]`
 * - recordWithMedia の場合は `media` が上記の images#view
 *
 * Input:
 * - `embeds`: viewRecord の `embeds`
 *
 * Output:
 * - サムネイルの画像一覧。該当なしは空配列
 */
const toQuoteImages = (embeds: unknown): SourceImage[] => {
    if (!Array.isArray(embeds)) return []
    for (const embed of embeds) {
        const value = asRecord(embed)
        const imagesView =
            value?.$type === "app.bsky.embed.recordWithMedia#view"
                ? asRecord(value.media)
                : value
        if (imagesView?.$type !== "app.bsky.embed.images#view") continue
        if (!Array.isArray(imagesView.images)) return []
        return imagesView.images.flatMap(image => {
            const item = asRecord(image)
            const thumb = asString(item?.thumb)
            if (!thumb) return []
            const ratio = asRecord(item?.aspectRatio)
            const width = ratio?.width
            const height = ratio?.height
            return [
                {
                    url: thumb,
                    alt: asString(item?.alt) ?? "",
                    // CDN の URL は画像ごとに一意のため、表示の key に使う
                    cid: thumb,
                    ...(typeof width === "number" &&
                    typeof height === "number" &&
                    width > 0 &&
                    height > 0
                        ? { aspectRatio: { width, height } }
                        : {}),
                },
            ]
        })
    }
    return []
}

/**
 * `app.bsky.embed.record#view` の `record` から引用を組み立てる。
 *
 * 想定する入力形状(最小要件):
 * - 投稿: `{ $type: "app.bsky.embed.record#viewRecord", uri, author: { handle }, value: { text, createdAt, facets? }, indexedAt, embeds? }`
 * - 表示できない: `$type` が `#viewNotFound`・`#viewBlocked`・`#viewDetached`
 *
 * Input:
 * - `record`: view の `record`
 *
 * Output:
 * - 引用。投稿以外（フィード・リスト等）や形が不正な投稿は `undefined`
 */
const toQuote = (record: unknown): PostQuote | undefined => {
    const value = asRecord(record)
    switch (value?.$type) {
        case "app.bsky.embed.record#viewNotFound":
        case "app.bsky.embed.record#viewBlocked":
        case "app.bsky.embed.record#viewDetached":
            return { kind: "unavailable" }
        case "app.bsky.embed.record#viewRecord":
            break
        default:
            return undefined
    }

    const post = asRecord(value.value)
    const author = asRecord(value.author)
    const handle = asString(author?.handle)
    const parsed = parseAtUri(asString(value.uri) ?? "")
    // 投稿（app.bsky.feed.post）以外のレコードの引用は表示しない
    if (
        !post ||
        post.$type !== "app.bsky.feed.post" ||
        !handle ||
        !parsed ||
        parsed.collection !== "app.bsky.feed.post"
    ) {
        return undefined
    }
    const text = asString(post.text) ?? ""
    return {
        kind: "post",
        webUrl: bskyPostUrlgen(handle, parsed.rkey),
        author: {
            handle,
            displayName: asString(author?.displayName) || undefined,
            avatar: asString(author?.avatar),
        },
        createdAt: asString(post.createdAt) ?? asString(value.indexedAt) ?? "",
        text,
        facets: normalizePostFacets(post.facets),
        images: toQuoteImages(value.embeds),
    }
}

/**
 * 投稿の埋め込みの view から、リンクカードと引用を取り出す。
 *
 * Input:
 * - `embed`: `PostView.embed`（未指定・不正な形も受け付ける）
 *
 * Output:
 * - `{ linkCard?, quote? }`。該当しない埋め込みでは空のオブジェクト
 *
 * 例:
 * - 入力: `{ $type: "app.bsky.embed.external#view", external: { uri: "https://example.com", title: "T", description: "" } }`
 * - 出力: `{ linkCard: { uri: "https://example.com", title: "T", description: "", domain: "example.com" } }`
 */
export const extractPostEmbedView = (embed: unknown): PostEmbedView => {
    const value = asRecord(embed)
    switch (value?.$type) {
        case "app.bsky.embed.external#view": {
            const linkCard = toLinkCard(value.external)
            return linkCard ? { linkCard } : {}
        }
        case "app.bsky.embed.record#view": {
            const quote = toQuote(value.record)
            return quote ? { quote } : {}
        }
        case "app.bsky.embed.recordWithMedia#view": {
            // recordWithMedia の record は `app.bsky.embed.record#view`（その中の record が引用元）
            const quote = toQuote(asRecord(value.record)?.record)
            return quote ? { quote } : {}
        }
        default:
            return {}
    }
}
