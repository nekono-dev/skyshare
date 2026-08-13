/**
 * Bluesky の自分の投稿一覧をフロント表示用に整形するヘルパー。
 *
 * 責務と処理概要:
 * - `app.bsky.feed.getAuthorFeed` のレスポンスを投稿カード用の最小形へ変換する。
 * - `dev.nekono.skyshare.entry` を `source.uri` で突き合わせ、該当する投稿へ付与する。
 * - 画像 URL は CDN URL に展開し、一覧 UI でそのまま表示できる形にする。
 */

import { AppBskyEmbedImages, AppBskyFeedPost } from "@atproto/api"
import { blobToCdnUrl } from "@/lib/entry"
import { bskyPostUrlgen, parseAtUri, skyshareEntryUrlgen } from "@/lib/url"
import type { SourceImage } from "@/lib/entry"

export type TimelinePostAuthor = {
    did: string
    handle: string
    displayName?: string
    avatar?: string
}

export type TimelineSkyshareEntry = {
    uri: string
    cid: string
    createdAt: string
    sourceUri: string
    sourceCid: string
    heading?: string
    caption?: string
    visualUrl?: string
    webUrl?: string
}

export type TimelinePost = {
    uri: string
    cid: string
    url: string
    indexedAt: string
    author: TimelinePostAuthor
    text: string
    images: SourceImage[]
    skyshareEntry?: TimelineSkyshareEntry
}

type RawTimelineEntry = {
    uri?: string
    cid?: string
    value?: {
        source?: {
            uri?: string
            cid?: string
        }
        manifest?: {
            visual?: {
                ref?: unknown
                mimeType?: string
            }
            heading?: string
            caption?: string
        }
        createdAt?: string
    }
}

/**
 * 投稿レコードから画像一覧を抽出する。
 *
 * Input:
 * - `postRecord`: app.bsky.feed.post のレコード
 * - `sourceRepoDid`: 画像 blob が属する repo DID
 *
 * Output:
 * - CDN URL へ変換済みの画像一覧。画像が無い場合は空配列。
 *
 * 例:
 * - 入力: 画像付き投稿レコード
 * - 出力: `[{ url: "https://cdn.bsky.app/...", alt: "..." }]`
 */
export const extractTimelinePostImages = (
    postRecord: AppBskyFeedPost.Main,
    sourceRepoDid: string,
): SourceImage[] => {
    const embedded = postRecord.embed

    if (embedded?.$type !== "app.bsky.embed.images") {
        return []
    }

    const imagesRecord = embedded as AppBskyEmbedImages.Main
    if (!Array.isArray(imagesRecord.images)) {
        return []
    }

    return imagesRecord.images
        .map(image => {
            const url = blobToCdnUrl(sourceRepoDid, image.image)
            if (!url) {
                return undefined
            }

            return {
                url,
                alt: typeof image.alt === "string" ? image.alt : "",
            }
        })
        .filter((image): image is SourceImage => image !== undefined)
}

/**
 * Skyshare entry を投稿一覧用の表示データへ変換する。
 *
 * Input:
 * - `entry`: listRecords の 1 件
 *
 * Output:
 * - 表示用に正規化した entry。最小要件を満たさない場合は `undefined`。
 *
 * 失敗時の方針:
 * - 必須の `uri` / `cid` / `source.uri` / `source.cid` / `createdAt` が欠ける場合は `undefined` を返す。
 */
export const normalizeTimelineEntry = (
    entry: RawTimelineEntry,
): TimelineSkyshareEntry | undefined => {
    if (
        typeof entry.uri !== "string" ||
        typeof entry.cid !== "string" ||
        typeof entry.value?.createdAt !== "string"
    ) {
        return undefined
    }

    if (
        typeof entry.value?.source?.uri !== "string" ||
        typeof entry.value?.source?.cid !== "string"
    ) {
        return undefined
    }

    const parsedEntryUri = parseAtUri(entry.uri)
    const visualUrl = parsedEntryUri
        ? blobToCdnUrl(parsedEntryUri.repo, entry.value?.manifest?.visual)
        : undefined
    const webUrl = parsedEntryUri
        ? skyshareEntryUrlgen(parsedEntryUri.repo, parsedEntryUri.rkey)
        : undefined

    return {
        uri: entry.uri,
        cid: entry.cid,
        createdAt: entry.value.createdAt,
        sourceUri: entry.value.source.uri,
        sourceCid: entry.value.source.cid,
        heading: entry.value.manifest?.heading,
        caption: entry.value.manifest?.caption,
        visualUrl,
        webUrl,
    }
}

/**
 * `source.uri` をキーに Skyshare entry を索引化する。
 *
 * Input:
 * - `entries`: listRecords で取得したエントリ配列
 *
 * Output:
 * - `source.uri` をキーにした entry の Map
 *
 * 例:
 * - 入力: `[{ value: { source: { uri: "at://..." }}}]`
 * - 出力: `Map { "at://..." => entry }`
 */
export const groupTimelineEntriesBySourceUri = (
    entries: RawTimelineEntry[],
) => {
    const grouped = new Map<string, TimelineSkyshareEntry>()

    for (const entry of entries) {
        const normalized = normalizeTimelineEntry(entry)
        if (!normalized) {
            continue
        }

        grouped.set(normalized.sourceUri, normalized)
    }

    return grouped
}

/**
 * feed item を一覧表示用データへ変換する。
 *
 * Input:
 * - `feedItem`: `app.bsky.feed.getAuthorFeed` の 1 要素
 * - `skyshareEntry`: 同一 source.uri に紐づく skyshare entry
 *
 * Output:
 * - 投稿カードで使う正規化済みデータ。最小要件不足時は `undefined`。
 */
export const normalizeTimelinePost = (
    feedItem: any,
    skyshareEntry?: TimelineSkyshareEntry,
): TimelinePost | undefined => {
    const post = feedItem?.post
    if (
        typeof post?.uri !== "string" ||
        typeof post?.cid !== "string" ||
        typeof post?.indexedAt !== "string" ||
        typeof post?.author?.did !== "string" ||
        typeof post?.author?.handle !== "string"
    ) {
        return undefined
    }

    const parsedPostUri = parseAtUri(post.uri)
    if (!parsedPostUri) {
        return undefined
    }

    const postRecord = post.record as AppBskyFeedPost.Main | undefined
    const text = typeof postRecord?.text === "string" ? postRecord.text : ""
    const images = postRecord
        ? extractTimelinePostImages(postRecord, post.author.did)
        : []

    return {
        uri: post.uri,
        cid: post.cid,
        url: bskyPostUrlgen(post.author.handle, parsedPostUri.rkey),
        indexedAt: post.indexedAt,
        author: {
            did: post.author.did,
            handle: post.author.handle,
            displayName:
                typeof post.author.displayName === "string"
                    ? post.author.displayName
                    : undefined,
            avatar:
                typeof post.author.avatar === "string"
                    ? post.author.avatar
                    : undefined,
        },
        text,
        images,
        skyshareEntry,
    }
}
