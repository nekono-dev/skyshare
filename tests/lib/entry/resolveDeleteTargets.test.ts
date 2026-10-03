import { describe, expect, it, vi } from "vitest"
import { resolveDeleteTargets } from "@/lib/entry/resolveDeleteTargets"

const OWNER = "did:plc:owner"
const SOURCE = `at://${OWNER}/app.bsky.feed.post/3lroot`

const node = (
    rkey: string,
    did = OWNER,
    replies: unknown[] = [],
    record?: Record<string, unknown>,
) => ({
    $type: "app.bsky.feed.defs#threadViewPost",
    post: {
        uri: `at://${did}/app.bsky.feed.post/${rkey}`,
        cid: "bafy",
        author: { did },
        record,
    },
    replies,
})

const makeAgent = (impl: () => Promise<unknown>) =>
    ({ app: { bsky: { feed: { getPostThread: vi.fn(impl) } } } }) as any

describe("resolveDeleteTargets", () => {
    it("単発投稿は1件のrkeyを返す", async () => {
        const agent = makeAgent(async () => ({
            data: { thread: node("3lroot") },
        }))
        expect(await resolveDeleteTargets(agent, OWNER, SOURCE)).toEqual({
            kind: "targets",
            rkeys: ["3lroot"],
        })
        expect(agent.app.bsky.feed.getPostThread).toHaveBeenCalledWith(
            expect.objectContaining({ uri: SOURCE, parentHeight: 0 }),
        )
    })

    it("自己後続投稿を時系列順に返す", async () => {
        const agent = makeAgent(async () => ({
            data: {
                thread: node("3lroot", OWNER, [
                    node("3l2", OWNER, [node("3l3")]),
                ]),
            },
        }))
        expect(await resolveDeleteTargets(agent, OWNER, SOURCE)).toEqual({
            kind: "targets",
            rkeys: ["3lroot", "3l2", "3l3"],
        })
    })

    it("第三者の返信で分岐した先は含めない", async () => {
        const agent = makeAgent(async () => ({
            data: {
                thread: node("3lroot", OWNER, [
                    node("3lx", "did:plc:other", [node("3lbranch")]),
                ]),
            },
        }))
        expect(await resolveDeleteTargets(agent, OWNER, SOURCE)).toEqual({
            kind: "targets",
            rkeys: ["3lroot"],
        })
    })

    it("自己投稿の分岐は時刻が近い側のみ選ぶ", async () => {
        const agent = makeAgent(async () => ({
            data: {
                thread: node(
                    "3lroot",
                    OWNER,
                    [
                        node("3lfar", OWNER, [], {
                            createdAt: "2026-01-05T00:00:00.000Z",
                        }),
                        node("3lnear", OWNER, [], {
                            createdAt: "2026-01-01T00:00:05.000Z",
                        }),
                    ],
                    { createdAt: "2026-01-01T00:00:00.000Z" },
                ),
            },
        }))
        expect(await resolveDeleteTargets(agent, OWNER, SOURCE)).toEqual({
            kind: "targets",
            rkeys: ["3lroot", "3lnear"],
        })
    })

    it("record.replyを持つsourceはnotThreadRoot", async () => {
        const ref = { uri: `at://${OWNER}/app.bsky.feed.post/3lp`, cid: "c" }
        const agent = makeAgent(async () => ({
            data: {
                thread: node("3lroot", OWNER, [], {
                    $type: "app.bsky.feed.post",
                    reply: { root: ref, parent: ref },
                }),
            },
        }))
        expect(await resolveDeleteTargets(agent, OWNER, SOURCE)).toEqual({
            kind: "notThreadRoot",
        })
    })

    it("NotFoundPostはsourceGone", async () => {
        const agent = makeAgent(async () => ({
            data: {
                thread: {
                    $type: "app.bsky.feed.defs#notFoundPost",
                    uri: SOURCE,
                    notFound: true,
                },
            },
        }))
        expect(await resolveDeleteTargets(agent, OWNER, SOURCE)).toEqual({
            kind: "sourceGone",
        })
    })

    it("XRPCエラーNotFoundはsourceGone", async () => {
        const agent = makeAgent(async () => {
            throw Object.assign(new Error("nf"), { error: "NotFound" })
        })
        expect(await resolveDeleteTargets(agent, OWNER, SOURCE)).toEqual({
            kind: "sourceGone",
        })
    })

    it("その他の取得失敗は例外を送出する", async () => {
        const agent = makeAgent(async () => {
            throw new Error("boom")
        })
        await expect(
            resolveDeleteTargets(agent, OWNER, SOURCE),
        ).rejects.toThrow("boom")
    })

    it("blocked等の想定外のthreadは例外を送出する", async () => {
        const agent = makeAgent(async () => ({
            data: {
                thread: {
                    $type: "app.bsky.feed.defs#blockedPost",
                    uri: SOURCE,
                    blocked: true,
                },
            },
        }))
        await expect(
            resolveDeleteTargets(agent, OWNER, SOURCE),
        ).rejects.toThrow()
    })

    it("所有者検証に失敗する投稿は除外される", async () => {
        const agent = makeAgent(async () => ({
            data: {
                thread: {
                    ...node("3lroot"),
                    replies: [
                        {
                            ...node("3lbad"),
                            post: {
                                uri: "at://did:plc:owner/app.bsky.graph.list/3lbad",
                                cid: "c",
                                author: { did: OWNER },
                            },
                        },
                    ],
                },
            },
        }))
        expect(await resolveDeleteTargets(agent, OWNER, SOURCE)).toEqual({
            kind: "targets",
            rkeys: ["3lroot"],
        })
    })
})
