// Entry の削除の範囲（P0・要件 2.1 の「Entry の削除の範囲」）: 所有者の直線の返信の鎖だけを削除対象にする
import { describe, expect, it, vi } from "vitest"
import { resolveDeleteTargets } from "@/lib/entry/resolveDeleteTargets"
import { TEST_DID } from "../../../fixtures/identities"

const OTHER_DID = "did:plc:testfixturebob00000000000000"

type Node = {
    uri: string
    did: string
    createdAt: string
    replies?: Node[]
    reply?: boolean
}

/** 投稿のビュー（PostView）の最小の形 */
const post = (
    rkey: string,
    did: string,
    createdAt: string,
    replyTo?: string,
) => ({
    uri: `at://${did}/app.bsky.feed.post/${rkey}`,
    cid: `bafy${rkey}`,
    author: { did, handle: "x.test" },
    record: {
        $type: "app.bsky.feed.post",
        text: "t",
        createdAt,
        ...(replyTo
            ? {
                  reply: {
                      root: { uri: replyTo, cid: "c" },
                      parent: { uri: replyTo, cid: "c" },
                  },
              }
            : {}),
    },
    indexedAt: createdAt,
})

/** スレッドのビュー（ThreadViewPost）を組み立てる */
const thread = (p: ReturnType<typeof post>, replies: unknown[] = []) => ({
    $type: "app.bsky.feed.defs#threadViewPost",
    post: p,
    replies,
})

const ROOT_URI = `at://${TEST_DID}/app.bsky.feed.post/3rootfixture`

/** getPostThread だけを持つ agent（テスト用） */
const agentReturning = (result: unknown) =>
    ({
        app: { bsky: { feed: { getPostThread: vi.fn(async () => result) } } },
    }) as never

describe("resolveDeleteTargets", () => {
    it("targets the owner's root and the linear chain of the owner's replies, in order", async () => {
        const child = thread(
            post(
                "3childfixture",
                TEST_DID,
                "2026-10-01T00:00:02.000Z",
                ROOT_URI,
            ),
            [],
        )
        const root = thread(
            post("3rootfixture", TEST_DID, "2026-10-01T00:00:00.000Z"),
            [child],
        )
        const result = await resolveDeleteTargets(
            agentReturning({ data: { thread: root } }),
            TEST_DID,
            ROOT_URI,
        )
        expect(result).toEqual({
            kind: "targets",
            rkeys: ["3rootfixture", "3childfixture"],
        })
    })

    it("does not target another user's reply, so their post is never deleted", async () => {
        const foreign = thread(
            post(
                "3foreignfixture",
                OTHER_DID,
                "2026-10-01T00:00:02.000Z",
                ROOT_URI,
            ),
            [],
        )
        const root = thread(
            post("3rootfixture", TEST_DID, "2026-10-01T00:00:00.000Z"),
            [foreign],
        )
        const result = await resolveDeleteTargets(
            agentReturning({ data: { thread: root } }),
            TEST_DID,
            ROOT_URI,
        )
        expect(result).toEqual({ kind: "targets", rkeys: ["3rootfixture"] })
    })

    it("reports notThreadRoot when the source is itself a reply, so nothing is deleted", async () => {
        const replyOnly = thread(
            post(
                "3rootfixture",
                TEST_DID,
                "2026-10-01T00:00:00.000Z",
                "at://x/y/parent",
            ),
        )
        const result = await resolveDeleteTargets(
            agentReturning({ data: { thread: replyOnly } }),
            TEST_DID,
            ROOT_URI,
        )
        expect(result).toEqual({ kind: "notThreadRoot" })
    })

    it("reports sourceGone when the source post no longer exists (NotFound)", async () => {
        const agent = {
            app: {
                bsky: {
                    feed: {
                        getPostThread: vi.fn(async () => {
                            throw { error: "NotFound" }
                        }),
                    },
                },
            },
        } as never
        expect(await resolveDeleteTargets(agent, TEST_DID, ROOT_URI)).toEqual({
            kind: "sourceGone",
        })
    })

    it("rethrows other failures instead of reporting an empty delete", async () => {
        const agent = {
            app: {
                bsky: {
                    feed: {
                        getPostThread: vi.fn(async () => {
                            throw new Error("network down")
                        }),
                    },
                },
            },
        } as never
        await expect(
            resolveDeleteTargets(agent, TEST_DID, ROOT_URI),
        ).rejects.toThrow("network down")
    })
})

describe("resolveDeleteTargets (other responses)", () => {
    it("reports sourceGone when the thread view is a not-found post", async () => {
        const agent = agentReturning({
            data: {
                thread: {
                    $type: "app.bsky.feed.defs#notFoundPost",
                    uri: ROOT_URI,
                    notFound: true,
                },
            },
        })
        expect(await resolveDeleteTargets(agent, TEST_DID, ROOT_URI)).toEqual({
            kind: "sourceGone",
        })
    })

    it("throws for an unexpected thread view instead of deleting anything", async () => {
        const agent = agentReturning({
            data: {
                thread: {
                    $type: "app.bsky.feed.defs#blockedPost",
                    uri: ROOT_URI,
                    blocked: true,
                },
            },
        })
        await expect(
            resolveDeleteTargets(agent, TEST_DID, ROOT_URI),
        ).rejects.toThrow("unexpected thread view")
    })
})
