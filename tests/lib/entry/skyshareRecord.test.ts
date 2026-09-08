import { describe, expect, it, vi } from "vitest"

import {
    buildSkyshareEntryRecord,
    toCreatedSkyshareEntry,
    updateSkyshareEntry,
} from "@/lib/entry/skyshareRecord"

describe("buildSkyshareEntryRecord", () => {
    it("投稿情報とvisualからレコード値を組み立てる", () => {
        const record = buildSkyshareEntryRecord({
            sourceUri: "at://did:plc:abc/app.bsky.feed.post/3labc",
            sourceCid: "bafypost",
            visual: { ref: "bafkre123" },
            postText: "Hello world",
            userName: "Alice",
            createdAt: "2026-01-01T00:00:00.000Z",
        })

        expect(record).toEqual({
            $type: "dev.nekono.skyshare.entry",
            source: {
                uri: "at://did:plc:abc/app.bsky.feed.post/3labc",
                cid: "bafypost",
            },
            manifest: {
                $type: "dev.nekono.skyshare.defs#manifest",
                visual: { ref: "bafkre123" },
                heading: "Alice 's Post",
                caption: "Hello world",
            },
            createdAt: "2026-01-01T00:00:00.000Z",
        })
    })

    it("本文が空白のみならcaptionは空文字になる", () => {
        const record = buildSkyshareEntryRecord({
            sourceUri: "at://did:plc:abc/app.bsky.feed.post/3labc",
            sourceCid: "bafypost",
            visual: undefined,
            postText: "   ",
            userName: "Alice",
            createdAt: "2026-01-01T00:00:00.000Z",
        })

        expect((record.manifest as { caption: string }).caption).toBe("")
    })
})

describe("toCreatedSkyshareEntry", () => {
    it("レコード値とapplyWrites結果からCreatedSkyshareEntryを組み立てる", () => {
        const record = buildSkyshareEntryRecord({
            sourceUri: "at://did:plc:abc/app.bsky.feed.post/3labc",
            sourceCid: "bafypost",
            visual: { ref: "bafkre123" },
            postText: "Hello world",
            userName: "Alice",
            createdAt: "2026-01-01T00:00:00.000Z",
        })

        const result = toCreatedSkyshareEntry(record, "did:plc:abc", {
            uri: "at://did:plc:abc/dev.nekono.skyshare.entry/3lxyz",
            cid: "bafyentry",
        })

        expect(result).toMatchObject({
            atUri: "at://did:plc:abc/dev.nekono.skyshare.entry/3lxyz",
            cid: "bafyentry",
            sourceUri: "at://did:plc:abc/app.bsky.feed.post/3labc",
            sourceCid: "bafypost",
            heading: "Alice 's Post",
            caption: "Hello world",
        })
        expect(result.webUrl).toBe(
            "https://skyshare.nekono.dev/entries/did:plc:abc@3lxyz/",
        )
    })
})

describe("updateSkyshareEntry", () => {
    it("既存レコードのsource/visual/createdAtを維持しheading/captionのみ更新する", async () => {
        const getRecord = vi.fn().mockResolvedValue({
            data: {
                cid: "bafyold",
                value: {
                    source: { uri: "at://x", cid: "bafypost" },
                    manifest: { visual: { ref: "bafkre123" } },
                    createdAt: "2026-01-01T00:00:00Z",
                },
            },
        })
        const putRecord = vi.fn().mockResolvedValue({
            data: {
                uri: "at://did:plc:abc/dev.nekono.skyshare.entry/3lxyz",
                cid: "bafynew",
            },
        })
        const agent = { com: { atproto: { repo: { getRecord, putRecord } } } }

        const result = await updateSkyshareEntry(
            agent as any,
            "did:plc:abc",
            "3lxyz",
            "新しい見出し",
            "新しい本文",
        )

        expect(putRecord).toHaveBeenCalledWith(
            expect.objectContaining({
                repo: "did:plc:abc",
                collection: "dev.nekono.skyshare.entry",
                rkey: "3lxyz",
                swapRecord: "bafyold",
                record: expect.objectContaining({
                    source: { uri: "at://x", cid: "bafypost" },
                    createdAt: "2026-01-01T00:00:00Z",
                    manifest: expect.objectContaining({
                        visual: { ref: "bafkre123" },
                        heading: "新しい見出し",
                        caption: "新しい本文",
                    }),
                }),
            }),
        )
        expect(result).toEqual({
            atUri: "at://did:plc:abc/dev.nekono.skyshare.entry/3lxyz",
            cid: "bafynew",
            heading: "新しい見出し",
            caption: "新しい本文",
        })
    })
})
