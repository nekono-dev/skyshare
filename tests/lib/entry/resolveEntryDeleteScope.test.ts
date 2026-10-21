import { describe, expect, it, vi, beforeEach } from "vitest"

vi.mock("@/lib/atproto/publicAgent", () => ({
    publicAtpAgent: {
        app: { bsky: { feed: { getPostThread: vi.fn() } } },
    },
}))

import { publicAtpAgent } from "@/lib/atproto/publicAgent"
import { resolveEntryDeleteScope } from "@/lib/entry/resolveEntryDeleteScope"

const getPostThread = vi.mocked(publicAtpAgent.app.bsky.feed.getPostThread)

const ownerDid = "did:plc:author"
const sourceUri = `at://${ownerDid}/app.bsky.feed.post/3lpost`

beforeEach(() => {
    vi.clearAllMocks()
})

describe("resolveEntryDeleteScope", () => {
    it("sourceUriが不正な形式なら unknown を返す", async () => {
        const result = await resolveEntryDeleteScope("not-an-at-uri")
        expect(result).toEqual({ kind: "unknown" })
        expect(getPostThread).not.toHaveBeenCalled()
    })

    it("後続の自己投稿が無い起点は deletable(1件) を返す", async () => {
        getPostThread.mockResolvedValue({
            data: {
                thread: {
                    $type: "app.bsky.feed.defs#threadViewPost",
                    post: {
                        uri: sourceUri,
                        cid: "c1",
                        author: { did: ownerDid, handle: "a.test" },
                        indexedAt: "2026-01-01T00:00:00.000Z",
                    },
                    replies: [],
                },
            },
        } as any)

        const result = await resolveEntryDeleteScope(sourceUri)
        expect(result.kind).toBe("deletable")
        if (result.kind !== "deletable") return
        expect(result.posts.map(post => post.uri)).toEqual([sourceUri])
        expect(getPostThread).toHaveBeenCalledWith(
            expect.objectContaining({ parentHeight: 0 }),
        )
    })

    it("後続の自己投稿があるスレッドは deletable(件数一致) を返す", async () => {
        getPostThread.mockResolvedValue({
            data: {
                thread: {
                    $type: "app.bsky.feed.defs#threadViewPost",
                    post: {
                        uri: sourceUri,
                        cid: "c1",
                        author: { did: ownerDid, handle: "a.test" },
                        indexedAt: "2026-01-01T00:00:00.000Z",
                    },
                    replies: [
                        {
                            $type: "app.bsky.feed.defs#threadViewPost",
                            post: {
                                uri: `at://${ownerDid}/app.bsky.feed.post/3lsecond`,
                                cid: "c2",
                                author: { did: ownerDid, handle: "a.test" },
                                indexedAt: "2026-01-01T00:00:00.000Z",
                            },
                            replies: [],
                        },
                    ],
                },
            },
        } as any)

        const result = await resolveEntryDeleteScope(sourceUri)
        expect(result.kind).toBe("deletable")
        if (result.kind !== "deletable") return
        // 古い順（sourceが先頭）で、削除対象と同数・同一uriになる。
        expect(result.posts.map(post => post.uri)).toEqual([
            sourceUri,
            `at://${ownerDid}/app.bsky.feed.post/3lsecond`,
        ])
    })

    it("[entry-delete-dialog/AC-13] 分岐がある場合でも、採用された1系統の件数で判定する", async () => {
        getPostThread.mockResolvedValue({
            data: {
                thread: {
                    $type: "app.bsky.feed.defs#threadViewPost",
                    post: {
                        uri: sourceUri,
                        cid: "c1",
                        author: { did: ownerDid, handle: "a.test" },
                        indexedAt: "2026-01-01T00:00:00.000Z",
                        record: { createdAt: "2026-01-01T00:00:00.000Z" },
                    },
                    replies: [
                        {
                            $type: "app.bsky.feed.defs#threadViewPost",
                            post: {
                                uri: `at://${ownerDid}/app.bsky.feed.post/3lfar`,
                                cid: "c2",
                                author: { did: ownerDid, handle: "a.test" },
                                indexedAt: "2026-01-01T00:00:00.000Z",
                                record: {
                                    createdAt: "2026-01-05T00:00:00.000Z",
                                },
                            },
                            replies: [],
                        },
                        {
                            $type: "app.bsky.feed.defs#threadViewPost",
                            post: {
                                uri: `at://${ownerDid}/app.bsky.feed.post/3lnear`,
                                cid: "c3",
                                author: { did: ownerDid, handle: "a.test" },
                                indexedAt: "2026-01-01T00:00:00.000Z",
                                record: {
                                    createdAt: "2026-01-01T00:00:05.000Z",
                                },
                            },
                            replies: [],
                        },
                    ],
                },
            },
        } as any)

        const result = await resolveEntryDeleteScope(sourceUri)
        expect(result.kind).toBe("deletable")
        if (result.kind !== "deletable") return
        expect(result.posts.map(post => post.uri)).toEqual([
            sourceUri,
            `at://${ownerDid}/app.bsky.feed.post/3lnear`,
        ])
    })

    it("record.replyを持つsourceは legacy を返す", async () => {
        const ref = {
            uri: `at://${ownerDid}/app.bsky.feed.post/3lroot`,
            cid: "c0",
        }
        getPostThread.mockResolvedValue({
            data: {
                thread: {
                    $type: "app.bsky.feed.defs#threadViewPost",
                    post: {
                        uri: sourceUri,
                        cid: "c1",
                        author: { did: ownerDid, handle: "a.test" },
                        indexedAt: "2026-01-01T00:00:00.000Z",
                        record: {
                            $type: "app.bsky.feed.post",
                            reply: { root: ref, parent: ref },
                        },
                    },
                    replies: [],
                },
            },
        } as any)

        expect(await resolveEntryDeleteScope(sourceUri)).toEqual({
            kind: "legacy",
        })
    })

    it("NotFoundPostは unknown を返す", async () => {
        getPostThread.mockResolvedValue({
            data: {
                thread: {
                    $type: "app.bsky.feed.defs#notFoundPost",
                    uri: sourceUri,
                    notFound: true,
                },
            },
        } as any)

        expect(await resolveEntryDeleteScope(sourceUri)).toEqual({
            kind: "unknown",
        })
    })

    it("getPostThreadが失敗した場合は unknown を返す", async () => {
        getPostThread.mockRejectedValue(new Error("network error"))

        const result = await resolveEntryDeleteScope(sourceUri)
        expect(result).toEqual({ kind: "unknown" })
    })

    it("変換不能な投稿（handle欠落）を含む場合は unknown を返す", async () => {
        getPostThread.mockResolvedValue({
            data: {
                thread: {
                    $type: "app.bsky.feed.defs#threadViewPost",
                    post: {
                        uri: sourceUri,
                        cid: "c1",
                        author: { did: ownerDid },
                    },
                    replies: [],
                },
            },
        } as any)

        const result = await resolveEntryDeleteScope(sourceUri)
        expect(result).toEqual({ kind: "unknown" })
    })
})
