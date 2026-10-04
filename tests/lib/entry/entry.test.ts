import { describe, expect, it } from "vitest"

import {
    blobToCdnUrl,
    buildVideoUrls,
    extractEmbedVideo,
    extractUnsupportedEmbedVideo,
    extractSourceImages,
    isDidIdentifier,
    parseEntryLocator,
    toCidString,
} from "@/lib/entry/entry"

describe("isDidIdentifier", () => {
    it("did: 形式は true", () => {
        expect(isDidIdentifier("did:plc:abc123")).toBe(true)
    })

    it("did: 形式でなければ false", () => {
        expect(isDidIdentifier("alice.bsky.social")).toBe(false)
        expect(isDidIdentifier("")).toBe(false)
    })
})

describe("parseEntryLocator", () => {
    it("絶対URL形式(entries/{did}@{rkey})を解析する", () => {
        expect(
            parseEntryLocator(
                encodeURIComponent(
                    "https://skyshare.nekono.dev/entries/did:plc:abc@3lxyz/",
                ),
            ),
        ).toEqual({ actor: "did:plc:abc", rkey: "3lxyz" })
    })

    it("at:// URI形式を解析する", () => {
        expect(
            parseEntryLocator(
                "at://did:plc:abc/dev.nekono.skyshare.entry/3lxyz",
            ),
        ).toEqual({ actor: "did:plc:abc", rkey: "3lxyz" })
    })

    it("compact形式({did}@{rkey})を解析する", () => {
        expect(parseEntryLocator("did:plc:abc@3lxyz")).toEqual({
            actor: "did:plc:abc",
            rkey: "3lxyz",
        })
    })

    it("actorがdidでない場合は undefined", () => {
        expect(parseEntryLocator("alice.bsky.social@3lxyz")).toBeUndefined()
    })

    it("形式不正なら undefined", () => {
        expect(parseEntryLocator("not-a-valid-locator")).toBeUndefined()
    })
})

describe("toCidString", () => {
    it("文字列はそのまま返す", () => {
        expect(toCidString("bafkre123")).toBe("bafkre123")
    })

    it("$link を持つオブジェクトから抽出する", () => {
        expect(toCidString({ $link: "bafkre123" })).toBe("bafkre123")
    })

    it("null/undefined は undefined", () => {
        expect(toCidString(null)).toBeUndefined()
        expect(toCidString(undefined)).toBeUndefined()
    })
})

describe("blobToCdnUrl", () => {
    it("blob refからCDN URLを生成する", () => {
        expect(blobToCdnUrl("did:plc:abc", { ref: "bafkre123" })).toBe(
            "https://cdn.bsky.app/img/feed_fullsize/plain/did%3Aplc%3Aabc/bafkre123",
        )
    })

    it("blob未指定は undefined", () => {
        expect(blobToCdnUrl("did:plc:abc", undefined)).toBeUndefined()
    })

    it("refが解決できない場合は undefined", () => {
        expect(blobToCdnUrl("did:plc:abc", { ref: null })).toBeUndefined()
    })
})

describe("extractSourceImages (gallery)", () => {
    it("app.bsky.embed.gallery から画像一覧を抽出し、未知の$typeは除外する", () => {
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
                        alt: "one",
                    },
                    { $type: "app.bsky.embed.gallery#other" },
                ],
            },
        } as any

        expect(extractSourceImages(postRecord, "did:plc:abc")).toEqual([
            {
                url: "https://cdn.bsky.app/img/feed_fullsize/plain/did%3Aplc%3Aabc/bafkre1",
                alt: "one",
                cid: "bafkre1",
            },
        ])
    })
})

describe("extractSourceImages", () => {
    it("app.bsky.embed.images から画像一覧を抽出する", () => {
        const postRecord = {
            $type: "app.bsky.feed.post",
            text: "",
            createdAt: "2026-01-01T00:00:00Z",
            embed: {
                $type: "app.bsky.embed.images",
                images: [
                    {
                        image: { ref: "bafkre123" },
                        alt: "photo",
                    },
                ],
            },
        } as any

        expect(extractSourceImages(postRecord, "did:plc:abc")).toEqual([
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

        expect(extractSourceImages(postRecord, "did:plc:abc")).toEqual([])
    })
})

describe("extractSourceImages (aspectRatio)", () => {
    const build = (aspectRatio: unknown) =>
        ({
            $type: "app.bsky.feed.post",
            text: "",
            createdAt: "2026-01-01T00:00:00Z",
            embed: {
                $type: "app.bsky.embed.images",
                images: [{ image: { ref: "bafkre1" }, alt: "a", aspectRatio }],
            },
        }) as any

    it("有効な aspectRatio は保持される", () => {
        const [img] = extractSourceImages(
            build({ width: 400, height: 300 }),
            "did:plc:abc",
        )
        expect(img.aspectRatio).toEqual({ width: 400, height: 300 })
    })

    it.each([
        ["0", { width: 0, height: 300 }],
        ["負数", { width: 400, height: -1 }],
        ["非数", { width: "400", height: 300 }],
        ["Infinity", { width: Infinity, height: 300 }],
        ["欠落", undefined],
    ])("%s の aspectRatio は設定されない", (_name, ratio) => {
        const [img] = extractSourceImages(build(ratio), "did:plc:abc")
        expect(img).not.toHaveProperty("aspectRatio")
    })
})

describe("extractEmbedVideo", () => {
    const videoEmbed = {
        $type: "app.bsky.embed.video",
        video: {
            $type: "blob",
            ref: { $link: "bafkreivideo" },
            mimeType: "video/mp4",
            size: 10,
        },
        alt: "海",
        aspectRatio: { width: 640, height: 360 },
    }

    it("動画 embed から URL・alt・aspectRatio を得る", () => {
        expect(extractEmbedVideo(videoEmbed as any, "did:plc:abc")).toEqual({
            cid: "bafkreivideo",
            playlistUrl:
                "https://video.bsky.app/watch/did%3Aplc%3Aabc/bafkreivideo/playlist.m3u8",
            thumbnailUrl:
                "https://video.bsky.app/watch/did%3Aplc%3Aabc/bafkreivideo/thumbnail.jpg",
            alt: "海",
            aspectRatio: { width: 640, height: 360 },
        })
    })

    it("画像 embed・recordWithMedia・embed なし・CID 不正は undefined", () => {
        expect(
            extractEmbedVideo({ $type: "app.bsky.embed.images" } as any, "d"),
        ).toBeUndefined()
        expect(
            extractEmbedVideo(
                {
                    $type: "app.bsky.embed.recordWithMedia",
                    media: videoEmbed,
                } as any,
                "d",
            ),
        ).toBeUndefined()
        expect(extractEmbedVideo(undefined, "d")).toBeUndefined()
        expect(
            extractEmbedVideo({ ...videoEmbed, video: {} } as any, "d"),
        ).toBeUndefined()
    })

    it("aspectRatio が不正なら省略し、alt が無ければ空文字", () => {
        const result = extractEmbedVideo(
            {
                ...videoEmbed,
                alt: undefined,
                aspectRatio: { width: 0, height: 1 },
            } as any,
            "did:plc:abc",
        )
        expect(result?.alt).toBe("")
        expect(result?.aspectRatio).toBeUndefined()
    })
})

describe("buildVideoUrls", () => {
    it("DID の `:` が %3A にエンコードされる", () => {
        expect(buildVideoUrls("did:plc:x", "cid").playlistUrl).toContain(
            "did%3Aplc%3Ax",
        )
    })
})

describe("extractUnsupportedEmbedVideo", () => {
    const media = {
        $type: "app.bsky.embed.video",
        video: { ref: { $link: "bafkreivideo" } },
    }

    it("recordWithMedia の media が動画のとき poster URL が得られる", () => {
        const result = extractUnsupportedEmbedVideo(
            { $type: "app.bsky.embed.recordWithMedia", media } as any,
            "did:plc:abc",
        )
        expect(result?.thumbnailUrl).toContain("/bafkreivideo/thumbnail.jpg")
    })

    it("media が画像・直接の動画 embed・media なしでは undefined", () => {
        expect(
            extractUnsupportedEmbedVideo(
                {
                    $type: "app.bsky.embed.recordWithMedia",
                    media: { $type: "app.bsky.embed.images" },
                } as any,
                "d",
            ),
        ).toBeUndefined()
        expect(extractUnsupportedEmbedVideo(media as any, "d")).toBeUndefined()
        expect(
            extractUnsupportedEmbedVideo(
                { $type: "app.bsky.embed.recordWithMedia" } as any,
                "d",
            ),
        ).toBeUndefined()
    })
})
