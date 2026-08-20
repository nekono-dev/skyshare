import { describe, expect, it } from "vitest"

import {
    bskyCdnUrlgen,
    bskyPostUrlgen,
    parseAtUri,
    parseOwnedAtUri,
    skyshareEntryPath,
    skyshareEntryUrlgen,
} from "@/lib/entry/url"

describe("bskyPostUrlgen", () => {
    it("bsky.app の投稿URLを生成する", () => {
        expect(bskyPostUrlgen("alice.bsky.social", "3lxyz")).toBe(
            "https://bsky.app/profile/alice.bsky.social/post/3lxyz",
        )
    })
})

describe("bskyCdnUrlgen", () => {
    it("repoDid/refをencodeURIComponentしてCDN URLを生成する", () => {
        expect(bskyCdnUrlgen("did:plc:abc", "bafkre123")).toBe(
            "https://cdn.bsky.app/img/feed_fullsize/plain/did%3Aplc%3Aabc/bafkre123",
        )
    })
})

describe("skyshareEntryPath", () => {
    it("相対パスを生成する", () => {
        expect(skyshareEntryPath("alice.bsky.social", "3lxyz")).toBe(
            "/entries/alice.bsky.social@3lxyz/",
        )
    })
})

describe("skyshareEntryUrlgen", () => {
    it("SITE を前置した絶対URLを生成する", () => {
        expect(skyshareEntryUrlgen("alice.bsky.social", "3lxyz")).toBe(
            "https://skyshare.nekono.dev/entries/alice.bsky.social@3lxyz/",
        )
    })
})

describe("parseAtUri", () => {
    it("正常な at:// URI を repo/collection/rkey へ分解する", () => {
        expect(parseAtUri("at://did:plc:abc/app.bsky.feed.post/3lxyz")).toEqual(
            {
                repo: "did:plc:abc",
                collection: "app.bsky.feed.post",
                rkey: "3lxyz",
            },
        )
    })

    it("形式不正な文字列は undefined を返す", () => {
        expect(parseAtUri("not-an-at-uri")).toBeUndefined()
        expect(parseAtUri("at://did:plc:abc/only-one-segment")).toBeUndefined()
    })
})

describe("parseOwnedAtUri", () => {
    const uri = "at://did:plc:abc/app.bsky.feed.post/3lxyz"

    it("collection・repo が一致すれば分解結果を返す", () => {
        expect(
            parseOwnedAtUri(uri, "app.bsky.feed.post", "did:plc:abc"),
        ).toEqual({
            repo: "did:plc:abc",
            collection: "app.bsky.feed.post",
            rkey: "3lxyz",
        })
    })

    it("collection が不一致なら undefined", () => {
        expect(
            parseOwnedAtUri(uri, "dev.nekono.skyshare.entry", "did:plc:abc"),
        ).toBeUndefined()
    })

    it("repo が不一致（他人のURI）なら undefined", () => {
        expect(
            parseOwnedAtUri(uri, "app.bsky.feed.post", "did:plc:other"),
        ).toBeUndefined()
    })

    it("URI 自体が不正な形式なら undefined", () => {
        expect(
            parseOwnedAtUri(
                "not-an-at-uri",
                "app.bsky.feed.post",
                "did:plc:abc",
            ),
        ).toBeUndefined()
    })
})
