import { describe, expect, it } from "vitest"

import {
    extractTimelinePostImages,
    groupTimelineEntriesBySourceUri,
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

    it("画像embedでなければ空配列", () => {
        const postRecord = {
            $type: "app.bsky.feed.post",
            text: "hello",
            createdAt: "2026-01-01T00:00:00Z",
        } as any
        expect(extractTimelinePostImages(postRecord, "did:plc:abc")).toEqual(
            [],
        )
    })
})

describe("normalizeTimelineEntry", () => {
    const validEntry = {
        uri: "at://did:plc:abc/dev.nekono.skyshare.entry/3lxyz",
        cid: "bafyentry",
        value: {
            source: { uri: "at://did:plc:abc/app.bsky.feed.post/3labc", cid: "bafypost" },
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
        expect(normalizeTimelinePost(feedItem, skyshareEntry)?.skyshareEntry).toBe(
            skyshareEntry,
        )
    })

    it("必須フィールドが欠ける場合は undefined", () => {
        expect(normalizeTimelinePost({ post: {} })).toBeUndefined()
        expect(normalizeTimelinePost(undefined)).toBeUndefined()
    })
})
