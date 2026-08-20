import { describe, expect, it, vi } from "vitest"

import { createEntryFromExistingPost } from "@/lib/entry/fromPost"

const session = { did: "did:plc:abc", handle: "alice.bsky.social" } as any
const postUri = "at://did:plc:abc/app.bsky.feed.post/3labc"
const ogImage = new Blob(["thumb"], { type: "image/jpeg" })

const imagePostRecord = {
    data: {
        cid: "bafypost",
        value: {
            $type: "app.bsky.feed.post",
            text: "hello",
            embed: {
                $type: "app.bsky.embed.images",
                images: [{ image: { ref: "bafkre123" }, alt: "" }],
            },
        },
    },
}

const makeAgent = (overrides: Partial<Record<string, any>> = {}) => ({
    uploadBlob: vi
        .fn()
        .mockResolvedValue({ data: { blob: { $type: "blob", ref: "x" } } }),
    getProfile: vi.fn().mockResolvedValue({ data: { displayName: "Alice" } }),
    com: {
        atproto: {
            repo: {
                getRecord: vi.fn().mockResolvedValue(imagePostRecord),
                createRecord: vi.fn().mockResolvedValue({
                    data: {
                        uri: "at://did:plc:abc/dev.nekono.skyshare.entry/3lxyz",
                        cid: "bafyentry",
                    },
                }),
            },
        },
    },
    ...overrides,
})

describe("createEntryFromExistingPost", () => {
    it("正常系: 画像投稿からentryを発行する", async () => {
        const agent = makeAgent()

        const result = await createEntryFromExistingPost(
            agent as any,
            postUri,
            session,
            ogImage,
        )

        expect(result.ok).toBe(true)
        if (result.ok) {
            expect(result.bskyUrl).toBe(
                "https://bsky.app/profile/alice.bsky.social/post/3labc",
            )
            expect(result.skyshareEntry.sourceUri).toBe(postUri)
        }
    })

    it("collectionが不一致なら400", async () => {
        const agent = makeAgent()
        const result = await createEntryFromExistingPost(
            agent as any,
            "at://did:plc:abc/dev.nekono.skyshare.entry/3lxyz",
            session,
            ogImage,
        )
        expect(result).toEqual({ ok: false, status: 400 })
    })

    it("repoが他人のものなら400", async () => {
        const agent = makeAgent()
        const result = await createEntryFromExistingPost(
            agent as any,
            "at://did:plc:other/app.bsky.feed.post/3labc",
            session,
            ogImage,
        )
        expect(result).toEqual({ ok: false, status: 400 })
    })

    it("getRecordが例外(投稿が見つからない)なら404", async () => {
        const agent = makeAgent({
            com: {
                atproto: {
                    repo: {
                        getRecord: vi
                            .fn()
                            .mockRejectedValue(new Error("not found")),
                        createRecord: vi.fn(),
                    },
                },
            },
        })
        const result = await createEntryFromExistingPost(
            agent as any,
            postUri,
            session,
            ogImage,
        )
        expect(result).toEqual({ ok: false, status: 404 })
    })

    it("対象投稿が画像投稿でなければ400", async () => {
        const agent = makeAgent({
            com: {
                atproto: {
                    repo: {
                        getRecord: vi.fn().mockResolvedValue({
                            data: {
                                cid: "bafypost",
                                value: {
                                    $type: "app.bsky.feed.post",
                                    text: "hello",
                                },
                            },
                        }),
                        createRecord: vi.fn(),
                    },
                },
            },
        })
        const result = await createEntryFromExistingPost(
            agent as any,
            postUri,
            session,
            ogImage,
        )
        expect(result).toEqual({ ok: false, status: 400 })
    })

    it("ogImage未指定なら400", async () => {
        const agent = makeAgent()
        const result = await createEntryFromExistingPost(
            agent as any,
            postUri,
            session,
            undefined,
        )
        expect(result).toEqual({ ok: false, status: 400 })
    })

    it("uploadBlob失敗なら500", async () => {
        const agent = makeAgent({
            uploadBlob: vi.fn().mockRejectedValue(new Error("upload failed")),
        })
        const result = await createEntryFromExistingPost(
            agent as any,
            postUri,
            session,
            ogImage,
        )
        expect(result).toEqual({ ok: false, status: 500 })
    })
})
