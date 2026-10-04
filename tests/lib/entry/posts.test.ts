import { describe, expect, it } from "vitest"

import {
    extractTimelinePostImages,
    hasEntryMedia,
    groupTimelineEntriesBySourceUri,
    normalizePostViewToTimelinePost,
    normalizeTimelineEntry,
    normalizeTimelinePost,
} from "@/lib/entry/posts"

describe("extractTimelinePostImages", () => {
    it("画像embedからCDN URL付き画像一覧を抽出する", () => {
        const postRecord = {
            $type: "app.bsky.feed.post",
            text: "",
            createdAt: "2026-01-01T00:00:00Z",
            embed: {
                $type: "app.bsky.embed.images",
                images: [{ image: { ref: "bafkre123" }, alt: "photo" }],
            },
        } as any

        expect(extractTimelinePostImages(postRecord, "did:plc:abc")).toEqual([
            {
                url: "https://cdn.bsky.app/img/feed_fullsize/plain/did%3Aplc%3Aabc/bafkre123",
                alt: "photo",
                cid: "bafkre123",
            },
        ])
    })

    it("gallery embedから画像一覧を抽出し、未知の$typeは除外する", () => {
        const postRecord = {
            $type: "app.bsky.feed.post",
            text: "",
            createdAt: "2026-01-01T00:00:00Z",
            embed: {
                $type: "app.bsky.embed.gallery",
                items: [
                    {
                        $type: "app.bsky.embed.gallery#image",
                        image: { ref: "bafkre1" },
                        alt: "a",
                    },
                    { $type: "app.bsky.embed.gallery#unknown" },
                    {
                        $type: "app.bsky.embed.gallery#image",
                        image: { ref: "bafkre2" },
                        alt: "b",
                    },
                ],
            },
        } as any

        expect(
            extractTimelinePostImages(postRecord, "did:plc:abc").map(
                image => image.cid,
            ),
        ).toEqual(["bafkre1", "bafkre2"])
    })

    it("画像embedでなければ空配列", () => {
        const postRecord = {
            $type: "app.bsky.feed.post",
            text: "hello",
            createdAt: "2026-01-01T00:00:00Z",
        } as any
        expect(extractTimelinePostImages(postRecord, "did:plc:abc")).toEqual([])
    })
})

describe("normalizeTimelineEntry", () => {
    const validEntry = {
        uri: "at://did:plc:abc/dev.nekono.skyshare.entry/3lxyz",
        cid: "bafyentry",
        value: {
            source: {
                uri: "at://did:plc:abc/app.bsky.feed.post/3labc",
                cid: "bafypost",
            },
            manifest: { heading: "旅行", caption: "京都にて" },
            createdAt: "2026-01-01T00:00:00Z",
        },
    }

    it("必須要件を満たすエントリを正規化する", () => {
        const result = normalizeTimelineEntry(validEntry)
        expect(result).toMatchObject({
            uri: validEntry.uri,
            cid: "bafyentry",
            sourceUri: "at://did:plc:abc/app.bsky.feed.post/3labc",
            sourceCid: "bafypost",
            heading: "旅行",
            caption: "京都にて",
        })
        expect(result?.webUrl).toBe(
            "https://skyshare.nekono.dev/entries/did:plc:abc@3lxyz/",
        )
    })

    it("source.uriが欠けている場合は undefined", () => {
        expect(
            normalizeTimelineEntry({
                uri: validEntry.uri,
                cid: "bafyentry",
                value: { createdAt: "2026-01-01T00:00:00Z" },
            }),
        ).toBeUndefined()
    })

    it("uri自体が欠けている場合は undefined", () => {
        expect(normalizeTimelineEntry({})).toBeUndefined()
    })
})

describe("groupTimelineEntriesBySourceUri", () => {
    it("source.uriをキーにMap化する", () => {
        const entry = {
            uri: "at://did:plc:abc/dev.nekono.skyshare.entry/3lxyz",
            cid: "bafyentry",
            value: {
                source: {
                    uri: "at://did:plc:abc/app.bsky.feed.post/3labc",
                    cid: "bafypost",
                },
                createdAt: "2026-01-01T00:00:00Z",
            },
        }
        const grouped = groupTimelineEntriesBySourceUri([entry])
        expect(grouped.size).toBe(1)
        expect(
            grouped.get("at://did:plc:abc/app.bsky.feed.post/3labc")?.uri,
        ).toBe(entry.uri)
    })

    it("不正なエントリはスキップする", () => {
        expect(groupTimelineEntriesBySourceUri([{}])).toEqual(new Map())
    })
})

describe("normalizeTimelinePost", () => {
    const feedItem = {
        post: {
            uri: "at://did:plc:abc/app.bsky.feed.post/3labc",
            cid: "bafypost",
            indexedAt: "2026-01-01T00:00:00Z",
            author: {
                did: "did:plc:abc",
                handle: "alice.bsky.social",
                displayName: "Alice",
            },
            record: { text: "hello" },
        },
    }

    it("正常な feedItem を正規化する", () => {
        const result = normalizeTimelinePost(feedItem)
        expect(result).toMatchObject({
            uri: feedItem.post.uri,
            cid: "bafypost",
            url: "https://bsky.app/profile/alice.bsky.social/post/3labc",
            text: "hello",
        })
        expect(result?.author.displayName).toBe("Alice")
    })

    it("skyshareEntryを付与できる", () => {
        const skyshareEntry = {
            uri: "x",
            cid: "y",
            createdAt: "2026-01-01T00:00:00Z",
            sourceUri: "z",
            sourceCid: "w",
        }
        expect(
            normalizeTimelinePost(feedItem, skyshareEntry)?.skyshareEntry,
        ).toBe(skyshareEntry)
    })

    it("必須フィールドが欠ける場合は undefined", () => {
        expect(normalizeTimelinePost({ post: {} })).toBeUndefined()
        expect(normalizeTimelinePost(undefined)).toBeUndefined()
    })
})

describe("normalizePostViewToTimelinePost", () => {
    const author = { did: "did:plc:abc", handle: "alice.bsky.social" }

    it("PostViewをTimelinePostへ変換する（normalizeTimelinePostへの委譲）", () => {
        const post = {
            uri: "at://did:plc:abc/app.bsky.feed.post/3lmid",
            cid: "bafymid",
            indexedAt: "2026-01-01T00:00:00Z",
            author,
            record: { text: "mid" },
        } as any

        const normalized = normalizePostViewToTimelinePost(post)
        expect(normalized).toMatchObject({
            uri: post.uri,
            cid: "bafymid",
            text: "mid",
        })
    })

    it("必須フィールドが欠ける場合は undefined", () => {
        expect(normalizePostViewToTimelinePost({} as any)).toBeUndefined()
    })
})

describe("動画投稿の TimelinePost", () => {
    const withEmbed = (embed: unknown) => ({
        post: {
            uri: "at://did:plc:abc/app.bsky.feed.post/3labc",
            cid: "bafypost",
            indexedAt: "2026-01-01T00:00:00Z",
            author: { did: "did:plc:abc", handle: "alice.bsky.social" },
            record: { text: "hello", embed },
        },
    })
    const video = {
        $type: "app.bsky.embed.video",
        video: { ref: { $link: "bafkreivideo" } },
    }

    it("動画投稿は video を持ち images は空", () => {
        const post = normalizeTimelinePost(withEmbed(video))
        expect(post?.images).toEqual([])
        expect(post?.video?.cid).toBe("bafkreivideo")
        expect(post?.unsupportedVideo).toBeUndefined()
        expect(hasEntryMedia(post!)).toBe(true)
    })

    it("recordWithMedia 内の動画は unsupportedVideo で、entry 素材にならない", () => {
        const post = normalizeTimelinePost(
            withEmbed({
                $type: "app.bsky.embed.recordWithMedia",
                media: video,
            }),
        )
        expect(post?.video).toBeUndefined()
        expect(post?.unsupportedVideo?.cid).toBe("bafkreivideo")
        expect(hasEntryMedia(post!)).toBe(false)
    })

    it("動画も画像も無い投稿は素材なし", () => {
        expect(
            hasEntryMedia(normalizeTimelinePost(withEmbed(undefined))!),
        ).toBe(false)
    })
})
