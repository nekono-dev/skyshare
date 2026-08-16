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
import { AppBskyEmbedImages, AppBskyFeedPost } from "@atproto/api"
import { bskyCdnUrlgen } from "@/lib/url"

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

export const extractSourceImages = (
    postRecord: AppBskyFeedPost.Main,
    sourceRepoDid: string,
): SourceImage[] => {
    const embedded = postRecord.embed

    const fromImagesRecord = (
        imagesRecord: AppBskyEmbedImages.Main,
    ): SourceImage[] => {
        if (!imagesRecord || !Array.isArray(imagesRecord.images)) return []
        return imagesRecord.images
            .map(img => {
                const url = blobToCdnUrl(sourceRepoDid, img.image)
                const cid = toCidString(img.image?.ref)
                if (!url || !cid) return
                return {
                    url,
                    alt: typeof img?.alt === "string" ? img.alt : "",
                    cid,
                }
            })
            .filter((img): img is SourceImage => img !== undefined)
    }

    if (embedded?.$type === "app.bsky.embed.images") {
        return fromImagesRecord(embedded as AppBskyEmbedImages.Main)
    }

    return []
}
