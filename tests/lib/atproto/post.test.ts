import { describe, expect, it } from "vitest"

import { buildBskyPostRecord, isReplyRefOwnedBySelf } from "@/lib/atproto/post"

describe("buildBskyPostRecord", () => {
    it("selfLabel指定時はlabelsをselfLabels形式に変換する", () => {
        const record = buildBskyPostRecord({
            text: "hello",
            facets: undefined,
            langs: ["ja"],
            embed: undefined,
            selfLabel: "sexual",
            reply: undefined,
            createdAt: "2026-01-01T00:00:00.000Z",
        })

        expect(record).toMatchObject({
            $type: "app.bsky.feed.post",
            text: "hello",
            langs: ["ja"],
            labels: {
                $type: "com.atproto.label.defs#selfLabels",
                values: [{ val: "sexual" }],
            },
            via: "Skyshare",
            createdAt: "2026-01-01T00:00:00.000Z",
        })
    })

    it("selfLabel未指定ならlabelsはundefined", () => {
        const record = buildBskyPostRecord({
            text: "hello",
            facets: undefined,
            langs: undefined,
            embed: undefined,
            selfLabel: undefined,
            reply: undefined,
            createdAt: "2026-01-01T00:00:00.000Z",
        })

        expect(record.labels).toBeUndefined()
    })

    it("reply指定時はそのままレコードへ含める", () => {
        const reply = {
            root: { uri: "at://did:plc:abc/app.bsky.feed.post/1", cid: "c1" },
            parent: { uri: "at://did:plc:abc/app.bsky.feed.post/2", cid: "c2" },
        }

        const record = buildBskyPostRecord({
            text: "hello",
            facets: undefined,
            langs: undefined,
            embed: undefined,
            selfLabel: undefined,
            reply,
            createdAt: "2026-01-01T00:00:00.000Z",
        })

        expect(record.reply).toEqual(reply)
    })

    it("reply未指定ならreplyはundefined", () => {
        const record = buildBskyPostRecord({
            text: "hello",
            facets: undefined,
            langs: undefined,
            embed: undefined,
            selfLabel: undefined,
            reply: undefined,
            createdAt: "2026-01-01T00:00:00.000Z",
        })

        expect(record.reply).toBeUndefined()
    })
})

describe("isReplyRefOwnedBySelf", () => {
    const did = "did:plc:abc"
    const ownPostUri = (rkey: string) =>
        `at://${did}/app.bsky.feed.post/${rkey}`
    const otherPostUri = (rkey: string) =>
        `at://did:plc:other/app.bsky.feed.post/${rkey}`

    it("reply未指定ならtrue", () => {
        expect(isReplyRefOwnedBySelf(undefined, did)).toBe(true)
    })

    it("root/parentともに自分の投稿ならtrue", () => {
        const reply = {
            root: { uri: ownPostUri("1"), cid: "c1" },
            parent: { uri: ownPostUri("2"), cid: "c2" },
        }
        expect(isReplyRefOwnedBySelf(reply, did)).toBe(true)
    })

    it("rootが他人の投稿ならfalse", () => {
        const reply = {
            root: { uri: otherPostUri("1"), cid: "c1" },
            parent: { uri: ownPostUri("2"), cid: "c2" },
        }
        expect(isReplyRefOwnedBySelf(reply, did)).toBe(false)
    })

    it("parentが他人の投稿ならfalse", () => {
        const reply = {
            root: { uri: ownPostUri("1"), cid: "c1" },
            parent: { uri: otherPostUri("2"), cid: "c2" },
        }
        expect(isReplyRefOwnedBySelf(reply, did)).toBe(false)
    })

    it("不正な形式のuriならfalse", () => {
        const reply = {
            root: { uri: "not-a-valid-uri", cid: "c1" },
            parent: { uri: ownPostUri("2"), cid: "c2" },
        }
        expect(isReplyRefOwnedBySelf(reply, did)).toBe(false)
    })
})
