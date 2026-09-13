import { describe, expect, it, vi, beforeEach } from "vitest"

vi.mock("@/lib/atproto/publicAgent", () => ({
    publicAtpAgent: {
        app: { bsky: { feed: { getPostThread: vi.fn() } } },
    },
}))

import { publicAtpAgent } from "@/lib/atproto/publicAgent"
import { resolveThreadDeleteOption } from "@/components/entry/EntryCard/resolveThreadDeleteOption"

const getPostThread = vi.mocked(publicAtpAgent.app.bsky.feed.getPostThread)

const ownerDid = "did:plc:author"
const sourceUri = `at://${ownerDid}/app.bsky.feed.post/3lpost`

beforeEach(() => {
    vi.clearAllMocks()
})

describe("resolveThreadDeleteOption", () => {
    it("sourceUriが不正な形式なら false を返す", async () => {
        const result = await resolveThreadDeleteOption("not-an-at-uri")
        expect(result).toBe(false)
        expect(getPostThread).not.toHaveBeenCalled()
    })

    it("後続の自己投稿が無いスレッドは false を返す", async () => {
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

        const result = await resolveThreadDeleteOption(sourceUri)
        expect(result).toBe(false)
    })

    it("後続の自己投稿があるスレッドは true を返す", async () => {
        getPostThread.mockResolvedValue({
            data: {
                thread: {
                    $type: "app.bsky.feed.defs#threadViewPost",
                    post: {
                        uri: sourceUri,
                        cid: "c1",
                        author: { did: ownerDid },
                    },
                    replies: [
                        {
                            $type: "app.bsky.feed.defs#threadViewPost",
                            post: {
                                uri: `at://${ownerDid}/app.bsky.feed.post/3lsecond`,
                                cid: "c2",
                                author: { did: ownerDid },
                            },
                            replies: [],
                        },
                    ],
                },
            },
        } as any)

        const result = await resolveThreadDeleteOption(sourceUri)
        expect(result).toBe(true)
    })

    it("getPostThreadが失敗した場合は false を返す", async () => {
        getPostThread.mockRejectedValue(new Error("network error"))

        const result = await resolveThreadDeleteOption(sourceUri)
        expect(result).toBe(false)
    })
})
