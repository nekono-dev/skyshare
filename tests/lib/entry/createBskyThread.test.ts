import { describe, expect, it, vi } from "vitest"

import {
    createBskyThread,
    type ThreadEntryInput,
    type ThreadPostInput,
} from "@/lib/entry/createBskyThread"

const did = "did:plc:abc"

/**
 * `applyWrites`をモックした最小限のagentを組み立てる。
 *
 * 処理の趣旨:
 * - `writes`の`collection`/`rkey`から機械的にuri/cidを生成し、
 *   `createBskyThread`が返す`CreateBskyThreadResult`が正しい順序・組み合わせで
 *   組み立てられるかだけを検証できるようにする。
 */
const makeAgent = () => ({
    com: {
        atproto: {
            repo: {
                applyWrites: vi
                    .fn()
                    .mockImplementation(
                        async ({
                            writes,
                        }: {
                            writes: { collection: string; rkey: string }[]
                        }) => ({
                            data: {
                                results: writes.map((w, i) => ({
                                    uri: `at://${did}/${w.collection}/${w.rkey}`,
                                    cid: `bafy-result-${i}`,
                                })),
                            },
                        }),
                    ),
            },
        },
    },
})

const entryInput: ThreadEntryInput = {
    visual: { $type: "blob", ref: "visual" },
    postText: "hello",
    userName: "Alice",
}

describe("createBskyThread: entry(source)の解決(specs/entry/backend/design.md §7.2)", () => {
    it("entryInput未指定ならskyshareEntryは作成されない", async () => {
        const agent = makeAgent()
        const posts: ThreadPostInput[] = [{ text: "1件目" }, { text: "2件目" }]

        const result = await createBskyThread(agent as any, did, posts)

        expect(result.posts).toHaveLength(2)
        expect(result.skyshareEntry).toBeUndefined()
    })

    it("単発投稿(posts.length===1)でentryInput指定時、sourceは自身(posts[0])になる", async () => {
        const agent = makeAgent()
        const posts: ThreadPostInput[] = [{ text: "1件目(画像)" }]

        const result = await createBskyThread(
            agent as any,
            did,
            posts,
            undefined,
            entryInput,
        )

        expect(result.posts).toHaveLength(1)
        expect(result.skyshareEntry).toBeDefined()
        expect(result.skyshareEntry?.sourceUri).toBe(result.posts[0].uri)
    })

    it("スレッド(posts.length>1)でentryInput指定時、sourceは常にposts[0]になる", async () => {
        const agent = makeAgent()
        const posts: ThreadPostInput[] = [
            { text: "1件目(テキストのみ)" },
            { text: "2件目(画像)" },
            { text: "3件目(画像)" },
        ]

        const result = await createBskyThread(
            agent as any,
            did,
            posts,
            undefined,
            entryInput,
        )

        expect(result.posts).toHaveLength(3)
        // sourceUriはrkeyベースで決定的なため`result.posts[0].uri`と直接比較できるが、
        // sourceCidは呼び出し前に事前計算した値(`cidForLex`)であり、このテストの
        // モック`applyWrites`が返す`results[0].cid`（実際のPDS応答を模した無関係な
        // ダミー値）とは一致しない。ここでは「posts[0]自身を指している」ことを
        // sourceUriで確認する。
        expect(result.skyshareEntry?.sourceUri).toBe(result.posts[0].uri)
        expect(result.skyshareEntry?.sourceUri).not.toBe(result.posts[1].uri)
    })

    it("skyshareEntryはレスポンス全体でトップレベルに高々1件のみ", async () => {
        const agent = makeAgent()
        const posts: ThreadPostInput[] = [
            { text: "1件目(画像)" },
            { text: "2件目(画像)" },
        ]

        const result = await createBskyThread(
            agent as any,
            did,
            posts,
            undefined,
            entryInput,
        )

        expect(result.posts[0]).not.toHaveProperty("skyshareEntry")
        expect(result.posts[1]).not.toHaveProperty("skyshareEntry")
        expect(result.skyshareEntry).toBeDefined()
    })

    it("applyWritesが失敗した場合は例外を投げる", async () => {
        const agent = {
            com: {
                atproto: {
                    repo: {
                        applyWrites: vi
                            .fn()
                            .mockRejectedValue(new Error("applyWrites failed")),
                    },
                },
            },
        }
        const posts: ThreadPostInput[] = [{ text: "1件目" }]

        await expect(
            createBskyThread(agent as any, did, posts),
        ).rejects.toThrow("applyWrites failed")
    })
})
