import { describe, expect, it, vi } from "vitest"

import { createSkyshareEntry, updateSkyshareEntry } from "@/lib/entry/skyshareRecord"

const session = {
    did: "did:plc:abc",
    handle: "alice.bsky.social",
} as any

describe("createSkyshareEntry", () => {
    it("レコードを作成しCreatedSkyshareEntryを返す", async () => {
        const createRecord = vi.fn().mockResolvedValue({
            data: {
                uri: "at://did:plc:abc/dev.nekono.skyshare.entry/3lxyz",
                cid: "bafyentry",
            },
        })
        const agent = { com: { atproto: { repo: { createRecord } } } }

        const result = await createSkyshareEntry(
            agent as any,
            "at://did:plc:abc/app.bsky.feed.post/3labc",
            "bafypost",
            { ref: "bafkre123" },
            "Hello world",
            "Alice",
            session,
        )

        expect(createRecord).toHaveBeenCalledWith(
            expect.objectContaining({
                repo: "did:plc:abc",
                collection: "dev.nekono.skyshare.entry",
            }),
        )
        expect(result).toMatchObject({
            atUri: "at://did:plc:abc/dev.nekono.skyshare.entry/3lxyz",
            cid: "bafyentry",
            sourceUri: "at://did:plc:abc/app.bsky.feed.post/3labc",
            sourceCid: "bafypost",
            heading: "Alice 's Post",
            caption: "Hello world",
        })
        expect(result?.webUrl).toBe(
            "https://skyshare.nekono.dev/entries/did:plc:abc@3lxyz/",
        )
    })

    it("本文が空白のみならcaptionは空文字になる", async () => {
        const createRecord = vi.fn().mockResolvedValue({
            data: {
                uri: "at://did:plc:abc/dev.nekono.skyshare.entry/3lxyz",
                cid: "bafyentry",
            },
        })
        const agent = { com: { atproto: { repo: { createRecord } } } }

        const result = await createSkyshareEntry(
            agent as any,
            "at://did:plc:abc/app.bsky.feed.post/3labc",
            "bafypost",
            undefined,
            "   ",
            "Alice",
            session,
        )

        expect(result?.caption).toBe("")
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
