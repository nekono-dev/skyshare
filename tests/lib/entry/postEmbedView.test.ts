import { describe, expect, it } from "vitest"
import { extractPostEmbedView } from "@/lib/entry/postEmbedView"

const viewRecord = {
    $type: "app.bsky.embed.record#viewRecord",
    uri: "at://did:plc:bob/app.bsky.feed.post/3lquoted",
    cid: "bafyquoted",
    author: {
        did: "did:plc:bob",
        handle: "bob.test",
        displayName: "Bob",
        avatar: "https://cdn.bsky.app/avatar.jpg",
    },
    value: {
        $type: "app.bsky.feed.post",
        text: "引用元 #tag",
        createdAt: "2026-01-02T00:00:00.000Z",
        facets: [
            {
                index: { byteStart: 10, byteEnd: 14 },
                features: [
                    { $type: "app.bsky.richtext.facet#tag", tag: "tag" },
                ],
            },
        ],
    },
    indexedAt: "2026-01-02T00:00:01.000Z",
    embeds: [
        {
            $type: "app.bsky.embed.images#view",
            images: [
                {
                    thumb: "https://cdn.bsky.app/thumb.jpg",
                    fullsize: "https://cdn.bsky.app/full.jpg",
                    alt: "写真",
                    aspectRatio: { width: 4, height: 3 },
                },
            ],
        },
    ],
}

describe("extractPostEmbedView", () => {
    it("[entry-detail/3.1] 外部リンクの埋め込みから、題名・説明・ドメイン・サムネイルを取り出す", () => {
        expect(
            extractPostEmbedView({
                $type: "app.bsky.embed.external#view",
                external: {
                    uri: "https://www.example.com/article",
                    title: "記事",
                    description: "説明",
                    thumb: "https://cdn.bsky.app/ext.jpg",
                },
            }),
        ).toEqual({
            linkCard: {
                uri: "https://www.example.com/article",
                title: "記事",
                description: "説明",
                domain: "www.example.com",
                thumb: "https://cdn.bsky.app/ext.jpg",
            },
        })
    })

    it("http/https 以外のリンクカードは取り出さない", () => {
        expect(
            extractPostEmbedView({
                $type: "app.bsky.embed.external#view",
                external: { uri: "javascript:alert(1)", title: "x" },
            }),
        ).toEqual({})
    })

    it("引用の埋め込みから、作者・本文・注釈・画像を取り出す", () => {
        expect(
            extractPostEmbedView({
                $type: "app.bsky.embed.record#view",
                record: viewRecord,
            }),
        ).toEqual({
            quote: {
                kind: "post",
                webUrl: "https://bsky.app/profile/bob.test/post/3lquoted",
                author: {
                    handle: "bob.test",
                    displayName: "Bob",
                    avatar: "https://cdn.bsky.app/avatar.jpg",
                },
                createdAt: "2026-01-02T00:00:00.000Z",
                text: "引用元 #tag",
                facets: [
                    {
                        index: { byteStart: 10, byteEnd: 14 },
                        features: [
                            {
                                $type: "app.bsky.richtext.facet#tag",
                                tag: "tag",
                            },
                        ],
                    },
                ],
                images: [
                    {
                        url: "https://cdn.bsky.app/thumb.jpg",
                        alt: "写真",
                        cid: "https://cdn.bsky.app/thumb.jpg",
                        aspectRatio: { width: 4, height: 3 },
                    },
                ],
            },
        })
    })

    it("[entry-detail/3.2] 画像や動画と併用した引用（recordWithMedia）から引用を取り出す", () => {
        const result = extractPostEmbedView({
            $type: "app.bsky.embed.recordWithMedia#view",
            record: { $type: "app.bsky.embed.record#view", record: viewRecord },
            media: { $type: "app.bsky.embed.video#view", cid: "bafyvideo" },
        })
        expect(result.quote?.kind).toBe("post")
        expect(result.linkCard).toBeUndefined()
    })

    it.each([
        "app.bsky.embed.record#viewNotFound",
        "app.bsky.embed.record#viewBlocked",
        "app.bsky.embed.record#viewDetached",
    ])("引用元が %s のときは表示できない引用にする", $type => {
        expect(
            extractPostEmbedView({
                $type: "app.bsky.embed.record#view",
                record: { $type, uri: "at://did:plc:bob/app.bsky.feed.post/x" },
            }),
        ).toEqual({ quote: { kind: "unavailable" } })
    })

    it("投稿以外（フィード）の引用と、未知・未指定の埋め込みは取り出さない", () => {
        expect(
            extractPostEmbedView({
                $type: "app.bsky.embed.record#view",
                record: {
                    $type: "app.bsky.feed.defs#generatorView",
                    uri: "at://did:plc:bob/app.bsky.feed.generator/x",
                },
            }),
        ).toEqual({})
        expect(
            extractPostEmbedView({ $type: "app.bsky.embed.images#view" }),
        ).toEqual({})
        expect(extractPostEmbedView(undefined)).toEqual({})
    })
})
