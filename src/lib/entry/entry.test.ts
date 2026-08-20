import { describe, expect, it } from "vitest"

import {
    blobToCdnUrl,
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
        expect(
            blobToCdnUrl("did:plc:abc", { ref: "bafkre123" }),
        ).toBe(
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
