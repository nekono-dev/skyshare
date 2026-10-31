// 投稿の原子的な作成（P0・要件 2.1 の「投稿の原子的な作成」）: 1 回の applyWrites にまとめる、返信のつながり、失敗の種類
import { describe, expect, it, vi } from "vitest"
import { createBskyThread } from "@/lib/entry/createBskyThread"
import { ENTRY_COLLECTION } from "@/lib/atproto/nsid"
import { TEST_DID } from "../../../fixtures/identities"

type Write = {
    $type: string
    collection: string
    rkey: string
    value: Record<string, any>
}

/** applyWrites を偽る agent。結果は書き込みの順に uri と cid を返す */
const fakeAgent = (impl?: (writes: Write[]) => unknown) => {
    const applyWrites = vi.fn(
        async ({ writes }: { repo: string; writes: Write[] }) => {
            if (impl) return impl(writes)
            return {
                data: {
                    results: writes.map((w, i) => ({
                        uri: `at://${TEST_DID}/${w.collection}/${w.rkey}`,
                        cid: `bafyfixture${i}`,
                    })),
                },
            }
        },
    )
    const agent = { com: { atproto: { repo: { applyWrites } } } }
    return { agent: agent as never, applyWrites }
}

describe("createBskyThread", () => {
    it("sends every post of the thread in one applyWrites call, so the thread is all-or-nothing", async () => {
        const { agent, applyWrites } = fakeAgent()
        await createBskyThread(agent, TEST_DID, [
            { text: "一件目" },
            { text: "二件目" },
            { text: "三件目" },
        ])
        expect(applyWrites).toHaveBeenCalledTimes(1)
        const writes = applyWrites.mock.calls[0][0].writes
        expect(
            writes.filter(w => w.collection === "app.bsky.feed.post"),
        ).toHaveLength(3)
    })

    it("chains the second and later posts as replies to the first (root and parent)", async () => {
        const { agent, applyWrites } = fakeAgent()
        await createBskyThread(agent, TEST_DID, [
            { text: "一件目" },
            { text: "二件目" },
        ])
        const [first, second] = applyWrites.mock.calls[0][0].writes.filter(
            w => w.collection === "app.bsky.feed.post",
        )
        expect(first.value.reply).toBeUndefined()
        expect(second.value.reply.root.uri).toBe(
            `at://${TEST_DID}/app.bsky.feed.post/${first.rkey}`,
        )
        expect(second.value.reply.parent.uri).toBe(
            `at://${TEST_DID}/app.bsky.feed.post/${first.rkey}`,
        )
    })

    it("returns the uri and cid of every post, in order", async () => {
        const { agent } = fakeAgent()
        const result = await createBskyThread(agent, TEST_DID, [
            { text: "一件目" },
            { text: "二件目" },
        ])
        expect(result.posts.map(p => p.cid)).toEqual([
            "bafyfixture0",
            "bafyfixture1",
        ])
    })

    it("propagates a failed applyWrites and reports no posts, so a partial thread is never returned", async () => {
        const { agent } = fakeAgent(() => {
            throw new Error("upstream failure")
        })
        await expect(
            createBskyThread(agent, TEST_DID, [
                { text: "一件目" },
                { text: "二件目" },
            ]),
        ).rejects.toThrow("upstream failure")
    })

    it("throws the fixed message when the result for a post is missing", async () => {
        const { agent } = fakeAgent(() => ({
            data: { results: [{ uri: "at://x/y/z", cid: "c" }] },
        }))
        await expect(
            createBskyThread(agent, TEST_DID, [
                { text: "一件目" },
                { text: "二件目" },
            ]),
        ).rejects.toThrow(
            "createBskyThread: missing applyWrites result for post index 1",
        )
    })

    it("points the skyshare entry at the first post itself, not at the reply root", async () => {
        const { agent, applyWrites } = fakeAgent()
        const result = await createBskyThread(
            agent,
            TEST_DID,
            [{ text: "一件目" }, { text: "二件目" }],
            undefined,
            {
                visual: { kind: "fixture" },
            },
        )
        const entry = applyWrites.mock.calls[0][0].writes.find(
            w => w.collection === ENTRY_COLLECTION,
        )
        expect(entry?.value.source.uri).toBe(result.posts[0].uri)
        expect(result.skyshareEntry).toBeDefined()
    })
})

describe("createBskyThread (gates)", () => {
    it("writes the threadgate and postgate of a post, both pointing at that post's record key", async () => {
        const { agent, applyWrites } = fakeAgent()
        await createBskyThread(agent, TEST_DID, [
            {
                text: "制限つき",
                gate: {
                    replyAudience: "nobody",
                    allowMentioned: false,
                    allowFollower: false,
                    allowFollowing: false,
                    listUris: [],
                    allowQuote: false,
                },
            },
        ])
        const writes = applyWrites.mock.calls[0][0].writes
        const post = writes.find(w => w.collection === "app.bsky.feed.post")
        const threadgate = writes.find(
            w => w.collection === "app.bsky.feed.threadgate",
        )
        const postgate = writes.find(
            w => w.collection === "app.bsky.feed.postgate",
        )
        expect(threadgate?.rkey).toBe(post?.rkey)
        expect(postgate?.rkey).toBe(post?.rkey)
        expect(threadgate?.value.post).toBe(
            `at://${TEST_DID}/app.bsky.feed.post/${post?.rkey}`,
        )
    })
})
