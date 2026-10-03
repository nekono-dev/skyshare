/**
 * Entry 関連ユーティリティ
 *
 * 責務:
 * - エントリ識別子の解析
 * - Blob/CID の抽出
 * - レコード内画像埋め込みの展開
 *
 * Cloudflare Workers 環境制約を遵守すること。
 */
import { AppBskyFeedPost } from "@atproto/api"
import { bskyCdnUrlgen } from "@/lib/entry/url"

export type SourceLocator = {
    actor: string
    rkey: string
}

export type EntryLike = {
    source?: {
        uri?: string
    }
    manifest?: {
        source?: {
            uri?: string
        }
        visual?: {
            ref?: unknown
            mimeType?: string
        }
        heading?: string
        caption?: string
    }
    createdAt?: string
}

export type SourceImage = {
    url: string
    alt: string
    cid: string
    /** 画像レコードの `aspectRatio`。未設定・不正値の場合は `undefined` */
    aspectRatio?: { width: number; height: number }
}

export const ENTRY_COLLECTION = "dev.nekono.skyshare.entry"

const DID_PATTERN = /^did:[a-z0-9]+:[A-Za-z0-9._:%-]+$/i

export const isDidIdentifier = (value: string): boolean => {
    return DID_PATTERN.test(value)
}

export const parseEntryLocator = (
    slugValue: string,
): SourceLocator | undefined => {
    const decoded = decodeURIComponent(slugValue)

    if (decoded.startsWith("http://") || decoded.startsWith("https://")) {
        const url = new URL(decoded)
        const parts = url.pathname.split("/").filter(Boolean)
        if (parts.length >= 2 && parts[0] === "entries") {
            const compact = parts[1].match(/^([^@]+)@([^@/]+)$/)
            if (compact) {
                if (!isDidIdentifier(compact[1])) {
                    return
                }
                return { actor: compact[1], rkey: compact[2] }
            }
        }
        return
    }

    if (decoded.startsWith("at://")) {
        const match = decoded.match(
            /^at:\/\/([^/]+)\/dev\.nekono\.skyshare\.entry\/([^/?#]+)$/,
        )
        if (!match) return
        if (!isDidIdentifier(match[1])) return
        return { actor: match[1], rkey: match[2] }
    }

    const compact = decoded.match(/^([^@]+)@([^@/]+)$/)
    if (compact) {
        if (!isDidIdentifier(compact[1])) return
        return { actor: compact[1], rkey: compact[2] }
    }
    return
}

export const toCidString = (ref: unknown): string | undefined => {
    if (typeof ref === "string") return ref
    if (ref && typeof ref === "object") {
        const maybeLink = (ref as Record<string, unknown>)["$link"]
        if (typeof maybeLink === "string") return maybeLink
        if (
            typeof (ref as { toString?: () => string }).toString === "function"
        ) {
            const value = (ref as { toString: () => string }).toString()
            if (
                typeof value === "string" &&
                value.length > 0 &&
                value !== "[object Object]"
            ) {
                return value
            }
        }
    }
    return
}

export const blobToCdnUrl = (
    repoDid: string,
    blob?: {
        ref?: unknown
        mimeType?: string
    },
): string | undefined => {
    if (!blob) return
    const ref = toCidString(blob.ref)
    if (!ref) return
    return bskyCdnUrlgen(repoDid, ref)
}

/**
 * blob 参照を持つ画像要素の配列から `SourceImage[]` を作る。
 *
 * 想定する入力形状(最小要件):
 * - 各要素が `{ image: BlobRef相当, alt?: string }` を持つ
 *
 * 処理の趣旨:
 * - url または cid が得られない要素は不正とみなして除外する。
 *
 * Input:
 * - `items`: images embed の `images` / gallery embed の画像 items
 * - `repoDid`: 画像 blob が属する repo DID
 *
 * Output:
 * - CDN URL へ変換済みの画像一覧
 *
 * 例:
 * - 入力: `[{ image: blob, alt: "猫" }]`
 * - 出力: `[{ url: "https://cdn.bsky.app/...", alt: "猫", cid: "bafk..." }]`
 */
const toSourceImages = (
    items: {
        image: any
        alt?: string
        aspectRatio?: { width?: unknown; height?: unknown }
    }[],
    repoDid: string,
): SourceImage[] =>
    items
        .map(item => {
            const url = blobToCdnUrl(repoDid, item.image)
            const cid = toCidString(item.image?.ref)
            if (!url || !cid) return
            const width = item?.aspectRatio?.width
            const height = item?.aspectRatio?.height
            const hasRatio =
                typeof width === "number" &&
                typeof height === "number" &&
                Number.isFinite(width) &&
                Number.isFinite(height) &&
                width > 0 &&
                height > 0
            return {
                url,
                alt: typeof item?.alt === "string" ? item.alt : "",
                cid,
                ...(hasRatio ? { aspectRatio: { width, height } } : {}),
            }
        })
        .filter((img): img is SourceImage => img !== undefined)

/**
 * embed の `$type` に応じて画像一覧を抽出する。
 *
 * 想定する入力形状(最小要件):
 * - `embed` は `$type` を持つ embed オブジェクト（未指定可）
 *
 * 処理の趣旨:
 * - `app.bsky.embed.images`（1〜4枚）と `app.bsky.embed.gallery`（5枚以上）を同一形式に正規化する。
 * - gallery の items のうち未知の `$type`（将来追加されるメディア種別）は除外する。
 * - 未対応の `$type` は空配列を返す。
 *
 * Input:
 * - `embed`: 投稿レコードの embed
 * - `repoDid`: 画像 blob が属する repo DID
 *
 * Output:
 * - CDN URL へ変換済みの画像一覧。画像が無い場合は空配列。
 *
 * 例:
 * - 入力: `{ $type: "app.bsky.embed.gallery", items: [...] }`
 * - 出力: 各画像の `{ url, alt, cid }` 配列
 */
export const extractEmbedImages = (
    embed: AppBskyFeedPost.Main["embed"] | undefined,
    repoDid: string,
): SourceImage[] => {
    switch (embed?.$type) {
        case "app.bsky.embed.images": {
            const images = (embed as { images?: unknown }).images
            if (!Array.isArray(images)) return []
            return toSourceImages(images, repoDid)
        }
        case "app.bsky.embed.gallery": {
            const items = (embed as { items?: unknown }).items
            if (!Array.isArray(items)) return []
            return toSourceImages(
                items.filter(
                    item => item?.$type === "app.bsky.embed.gallery#image",
                ),
                repoDid,
            )
        }
        default:
            return []
    }
}

/**
 * 投稿レコードから元投稿の画像一覧を抽出する（`extractEmbedImages` の薄いラッパー）。
 *
 * Input:
 * - `postRecord`: app.bsky.feed.post のレコード
 * - `sourceRepoDid`: 画像 blob が属する repo DID
 *
 * Output:
 * - 画像一覧。画像が無い場合は空配列。
 *
 * 例:
 * - 入力: 画像5枚の gallery 投稿
 * - 出力: 5件の `SourceImage`
 */
export const extractSourceImages = (
    postRecord: AppBskyFeedPost.Main,
    sourceRepoDid: string,
): SourceImage[] => extractEmbedImages(postRecord.embed, sourceRepoDid)
