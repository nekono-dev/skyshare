import { describe, expect, it, vi } from "vitest"

import { buildTimelineThreads } from "@/lib/entry/timelineThreads"
import type { TimelineSkyshareEntry } from "@/lib/entry/posts"

const did = "did:plc:author"
const author = { did, handle: "alice.bsky.social" }

/** テスト用の最小限のFeedViewPostを組み立てる。 */
const makeFeedItem = (
    rkey: string,
    indexedAt: string,
    opts: {
        replyCount?: number
        replyToRkey?: string
        /** スレッド先頭(root)のrkey。省略時はreplyToRkeyと同じ（直接rootへの返信）とみなす。 */
        rootRkey?: string
        /** スレッド先頭(root)を所有するrepoのDID。省略時は自分(他者起点を再現する場合に指定)。 */
        rootDid?: string
    } = {},
) => ({
    post: {
        uri: `at://did:plc:author/app.bsky.feed.post/${rkey}`,
        cid: `cid-${rkey}`,
        indexedAt,
        author,
        replyCount: opts.replyCount,
        record: {
            text: rkey,
            ...(opts.replyToRkey
                ? {
                      reply: {
                          parent: {
                              uri: `at://did:plc:author/app.bsky.feed.post/${opts.replyToRkey}`,
                              cid: `cid-${opts.replyToRkey}`,
                          },
                          root: {
                              uri: `at://${opts.rootDid ?? did}/app.bsky.feed.post/${opts.rootRkey ?? opts.replyToRkey}`,
                              cid: `cid-${opts.rootRkey ?? opts.replyToRkey}`,
                          },
                      },
                  }
                : {}),
        },
    },
})

/** テスト用の最小限のThreadViewPostノード（getPostThreadの応答用）。 */
const makeThreadNode = (
    rkey: string,
    indexedAt: string,
    replies: any[] = [],
    opts: { authorDid?: string; createdAt?: string } = {},
) => ({
    $type: "app.bsky.feed.defs#threadViewPost",
    post: {
        uri: `at://did:plc:author/app.bsky.feed.post/${rkey}`,
        cid: `cid-${rkey}`,
        indexedAt,
        author: opts.authorDid ? { did: opts.authorDid } : author,
        record: {
            text: rkey,
            ...(opts.createdAt !== undefined
                ? { createdAt: opts.createdAt }
                : {}),
        },
    },
    replies,
})

const emptyEntries = new Map<string, TimelineSkyshareEntry>()

describe("buildTimelineThreads", () => {
    it("単独投稿のみの場合、各投稿がreplies:[]の単独ThreadGroupになる", () => {
        const getPostThread = vi.fn()
        const agent = { app: { bsky: { feed: { getPostThread } } } } as any

        const feed = [
            makeFeedItem("b", "2026-01-02T00:00:00Z"),
            makeFeedItem("a", "2026-01-01T00:00:00Z"),
        ]

        return buildTimelineThreads(agent, did, feed as any, emptyEntries).then(
            threads => {
                expect(getPostThread).not.toHaveBeenCalled()
                expect(threads).toHaveLength(2)
                expect(threads[0]).toMatchObject({
                    rootPost: { uri: feed[0].post.uri },
                    replies: [],
                })
                expect(threads[1]).toMatchObject({
                    rootPost: { uri: feed[1].post.uri },
                    replies: [],
                })
            },
        )
    })

    it("[timeline-api/AC-2 timeline-api/AC-11] 通常のスレッド(root+mid+tailがすべてfeedに存在)を1つのThreadGroupにまとめる", async () => {
        const getPostThread = vi.fn().mockResolvedValue({
            data: {
                thread: makeThreadNode("root", "2026-01-01T00:00:00Z", [
                    makeThreadNode("mid", "2026-01-01T00:01:00Z", [
                        makeThreadNode("tail", "2026-01-01T00:02:00Z"),
                    ]),
                ]),
            },
        })
        const agent = { app: { bsky: { feed: { getPostThread } } } } as any

        const feed = [
            makeFeedItem("tail", "2026-01-01T00:02:00Z", {
                replyToRkey: "mid",
                rootRkey: "root",
            }),
            makeFeedItem("mid", "2026-01-01T00:01:00Z", {
                replyToRkey: "root",
            }),
            makeFeedItem("root", "2026-01-01T00:00:00Z", { replyCount: 2 }),
        ]

        const threads = await buildTimelineThreads(
            agent,
            did,
            feed as any,
            emptyEntries,
        )

        expect(getPostThread).toHaveBeenCalledTimes(1)
        expect(threads).toHaveLength(1)
        expect(threads[0].rootPost.uri).toBe(feed[2].post.uri)
        expect(threads[0].replies.map(p => p.uri)).toEqual([
            feed[1].post.uri,
            feed[0].post.uri,
        ])
    })

    it("[timeline-api/AC-5] rootは残るが後続投稿がすべて欠落している場合でも、replyCountを手がかりに補完する", async () => {
        const getPostThread = vi.fn().mockResolvedValue({
            data: {
                thread: makeThreadNode("root", "2026-01-01T00:00:00Z", [
                    makeThreadNode("mid", "2026-01-01T00:01:00Z", [
                        makeThreadNode("tail", "2026-01-01T00:02:00Z"),
                    ]),
                ]),
            },
        })
        const agent = { app: { bsky: { feed: { getPostThread } } } } as any

        // "mid"/"tail" はfeedに一切現れない（gap検出方式では検知不可能なケース）。
        const feed = [
            makeFeedItem("root", "2026-01-01T00:00:00Z", { replyCount: 2 }),
        ]

        const threads = await buildTimelineThreads(
            agent,
            did,
            feed as any,
            emptyEntries,
        )

        expect(getPostThread).toHaveBeenCalledWith(
            expect.objectContaining({ uri: feed[0].post.uri }),
        )
        expect(threads).toHaveLength(1)
        expect(threads[0].rootPost.uri).toBe(feed[0].post.uri)
        expect(threads[0].replies.map(p => p.uri)).toEqual([
            "at://did:plc:author/app.bsky.feed.post/mid",
            "at://did:plc:author/app.bsky.feed.post/tail",
        ])
    })

    it("[timeline-api/AC-5] 中間投稿が欠落している場合でも、末尾投稿のrecord.replyから補完する", async () => {
        const getPostThread = vi.fn().mockResolvedValue({
            data: {
                thread: makeThreadNode("root", "2026-01-01T00:00:00Z", [
                    makeThreadNode("mid", "2026-01-01T00:01:00Z", [
                        makeThreadNode("tail", "2026-01-01T00:02:00Z"),
                    ]),
                ]),
            },
        })
        const agent = { app: { bsky: { feed: { getPostThread } } } } as any

        // "mid" はfeedから欠落。"tail"のrecord.replyはmidを指すが、rootを
        // 権威解決のトリガーとして使う（extractReplyRootUri経由）。
        const feed = [
            makeFeedItem("tail", "2026-01-01T00:02:00Z", {
                replyToRkey: "mid",
                rootRkey: "root",
            }),
            makeFeedItem("root", "2026-01-01T00:00:00Z"),
        ]

        const threads = await buildTimelineThreads(
            agent,
            did,
            feed as any,
            emptyEntries,
        )

        expect(getPostThread).toHaveBeenCalledWith(
            expect.objectContaining({ uri: feed[1].post.uri }),
        )
        expect(threads).toHaveLength(1)
        expect(threads[0].rootPost.uri).toBe(feed[1].post.uri)
        expect(threads[0].replies.map(p => p.uri)).toEqual([
            "at://did:plc:author/app.bsky.feed.post/mid",
            feed[0].post.uri,
        ])
    })

    it("getPostThreadが失敗したスレッドは、feedにある投稿のみで単独ThreadGroupとして返す", async () => {
        const getPostThread = vi.fn().mockRejectedValue(new Error("boom"))
        const agent = { app: { bsky: { feed: { getPostThread } } } } as any
        const consoleSpy = vi
            .spyOn(console, "error")
            .mockImplementation(() => undefined)

        const feed = [
            makeFeedItem("root", "2026-01-01T00:00:00Z", { replyCount: 1 }),
        ]

        const threads = await buildTimelineThreads(
            agent,
            did,
            feed as any,
            emptyEntries,
        )

        expect(threads).toHaveLength(1)
        expect(threads[0]).toMatchObject({
            rootPost: { uri: feed[0].post.uri },
            replies: [],
        })
        consoleSpy.mockRestore()
    })

    it("複数スレッドが同時に存在する場合、feedの出現順(新しい順)を維持する", async () => {
        const getPostThread = vi
            .fn()
            .mockImplementation(({ uri }: { uri: string }) => {
                if (uri.endsWith("/threadA-root")) {
                    return Promise.resolve({
                        data: {
                            thread: makeThreadNode(
                                "threadA-root",
                                "2026-01-01T00:00:00Z",
                                [
                                    makeThreadNode(
                                        "threadA-tail",
                                        "2026-01-01T00:01:00Z",
                                    ),
                                ],
                            ),
                        },
                    })
                }
                return Promise.resolve({
                    data: {
                        thread: makeThreadNode(
                            "threadB-root",
                            "2026-01-02T00:00:00Z",
                            [
                                makeThreadNode(
                                    "threadB-tail",
                                    "2026-01-02T00:01:00Z",
                                ),
                            ],
                        ),
                    },
                })
            })
        const agent = { app: { bsky: { feed: { getPostThread } } } } as any

        // feedはindexedAt降順（新しい順）: threadB-tail(新) → threadA-tail → threadB-root → threadA-root(古)
        const feed = [
            makeFeedItem("threadB-tail", "2026-01-02T00:01:00Z", {
                replyToRkey: "threadB-root",
            }),
            makeFeedItem("threadA-tail", "2026-01-01T00:01:00Z", {
                replyToRkey: "threadA-root",
            }),
            makeFeedItem("threadB-root", "2026-01-02T00:00:00Z", {
                replyCount: 1,
            }),
            makeFeedItem("threadA-root", "2026-01-01T00:00:00Z", {
                replyCount: 1,
            }),
        ]

        const threads = await buildTimelineThreads(
            agent,
            did,
            feed as any,
            emptyEntries,
        )

        expect(threads).toHaveLength(2)
        expect(threads[0].rootPost.uri).toBe(
            "at://did:plc:author/app.bsky.feed.post/threadB-root",
        )
        expect(threads[1].rootPost.uri).toBe(
            "at://did:plc:author/app.bsky.feed.post/threadA-root",
        )
    })

    it("[timeline-api/AC-3 timeline-api/AC-4] 分岐時、採用された系統のみが1つのThreadGroupになり、採用されなかった側はTimelineに一切含まれない", async () => {
        const getPostThread = vi.fn().mockResolvedValue({
            data: {
                thread: makeThreadNode(
                    "root",
                    "2026-01-01T00:00:00Z",
                    [
                        // Dは出現順で先だが、rootとのcreatedAt差が大きい(事後の別分岐)
                        makeThreadNode("branchD", "2026-01-05T00:00:00Z", [], {
                            createdAt: "2026-01-05T00:00:00Z",
                        }),
                        // Bはrootに近い時刻(意図した続き)
                        makeThreadNode(
                            "branchB",
                            "2026-01-01T00:00:05Z",
                            [
                                makeThreadNode(
                                    "branchC",
                                    "2026-01-01T00:00:10Z",
                                    [],
                                    { createdAt: "2026-01-01T00:00:10Z" },
                                ),
                            ],
                            { createdAt: "2026-01-01T00:00:05Z" },
                        ),
                    ],
                    { createdAt: "2026-01-01T00:00:00Z" },
                ),
            },
        })
        const agent = { app: { bsky: { feed: { getPostThread } } } } as any

        const feed = [
            makeFeedItem("branchD", "2026-01-05T00:00:00Z", {
                replyToRkey: "root",
            }),
            makeFeedItem("branchC", "2026-01-01T00:00:10Z", {
                replyToRkey: "branchB",
                rootRkey: "root",
            }),
            makeFeedItem("branchB", "2026-01-01T00:00:05Z", {
                replyToRkey: "root",
            }),
            makeFeedItem("root", "2026-01-01T00:00:00Z", { replyCount: 2 }),
        ]

        const threads = await buildTimelineThreads(
            agent,
            did,
            feed as any,
            emptyEntries,
        )

        // root-branchB-branchCの1グループのみ。branchDは単独投稿としても出ない。
        expect(threads).toHaveLength(1)
        expect(threads[0].rootPost.uri).toBe(feed[3].post.uri)
        expect(threads[0].replies.map(p => p.uri)).toEqual([
            feed[2].post.uri,
            feed[1].post.uri,
        ])
    })

    it("[timeline-api/AC-8] 採用側が削除された場合、次回評価で不採用だった系統が新たにメインスレッドとして表示される", async () => {
        const feed = [
            makeFeedItem("branchD", "2026-01-05T00:00:00Z", {
                replyToRkey: "root",
            }),
            makeFeedItem("root", "2026-01-01T00:00:00Z", { replyCount: 1 }),
        ]
        // branchB削除後のgetPostThread応答（残る自己返信はDのみ）
        const getPostThread = vi.fn().mockResolvedValue({
            data: {
                thread: makeThreadNode(
                    "root",
                    "2026-01-01T00:00:00Z",
                    [
                        makeThreadNode("branchD", "2026-01-05T00:00:00Z", [], {
                            createdAt: "2026-01-05T00:00:00Z",
                        }),
                    ],
                    { createdAt: "2026-01-01T00:00:00Z" },
                ),
            },
        })
        const agent = { app: { bsky: { feed: { getPostThread } } } } as any

        const threads = await buildTimelineThreads(
            agent,
            did,
            feed as any,
            emptyEntries,
        )

        expect(threads).toHaveLength(1)
        expect(threads[0].rootPost.uri).toBe(feed[1].post.uri)
        expect(threads[0].replies.map(p => p.uri)).toEqual([feed[0].post.uri])
    })

    it("[timeline-api/AC-1] 他人の投稿への返信から始まるスレッドは、後続が自分の投稿のみでもTimelineに一切含まれず、getPostThreadも呼ばれない", async () => {
        const otherDid = "did:plc:other"
        const getPostThread = vi.fn()
        const agent = { app: { bsky: { feed: { getPostThread } } } } as any

        const feed = [
            // 他人のroot→自分の返信1→自分の返信2
            makeFeedItem("my-reply2", "2026-01-01T00:02:00Z", {
                replyToRkey: "my-reply1",
                rootRkey: "other-root",
                rootDid: otherDid,
            }),
            makeFeedItem("my-reply1", "2026-01-01T00:01:00Z", {
                replyToRkey: "other-root",
                rootDid: otherDid,
                replyCount: 1,
            }),
        ]

        const threads = await buildTimelineThreads(
            agent,
            did,
            feed as any,
            emptyEntries,
        )

        expect(threads).toEqual([])
        expect(getPostThread).not.toHaveBeenCalled()
    })

    it("[timeline-api/AC-6] メインスレッドのrootがfeedに現れない場合、rootのindexedAtに基づく位置へ新しい順を保って挿入される", async () => {
        const getPostThread = vi.fn().mockResolvedValue({
            data: {
                thread: makeThreadNode(
                    "root",
                    "2026-01-02T00:00:00Z",
                    [
                        makeThreadNode("r1", "2026-01-04T00:00:00Z", [], {
                            createdAt: "2026-01-04T00:00:00Z",
                        }),
                    ],
                    { createdAt: "2026-01-02T00:00:00Z" },
                ),
            },
        })
        const agent = { app: { bsky: { feed: { getPostThread } } } } as any

        const feed = [
            makeFeedItem("newest", "2026-01-05T00:00:00Z"),
            makeFeedItem("r1", "2026-01-04T00:00:00Z", { replyToRkey: "root" }),
            makeFeedItem("oldest", "2026-01-01T00:00:00Z"),
        ]

        const threads = await buildTimelineThreads(
            agent,
            did,
            feed as any,
            emptyEntries,
        )

        expect(threads.map(t => t.rootPost.uri.split("/").pop())).toEqual([
            "newest",
            "root",
            "oldest",
        ])
        expect(threads[1].replies.map(p => p.uri.split("/").pop())).toEqual([
            "r1",
        ])
    })

    it("[timeline-api/AC-7] getPostThreadが失敗した場合、自分がルートの投稿は単独投稿として表示され、返信側は表示されない", async () => {
        const getPostThread = vi.fn().mockRejectedValue(new Error("boom"))
        const agent = { app: { bsky: { feed: { getPostThread } } } } as any
        const errSpy = vi.spyOn(console, "error").mockImplementation(() => {})

        const feed = [
            makeFeedItem("r1", "2026-01-02T00:00:00Z", { replyToRkey: "root" }),
            makeFeedItem("root", "2026-01-01T00:00:00Z", { replyCount: 1 }),
        ]

        const threads = await buildTimelineThreads(
            agent,
            did,
            feed as any,
            emptyEntries,
        )
        errSpy.mockRestore()

        expect(threads).toHaveLength(1)
        expect(threads[0].rootPost.uri).toBe(feed[1].post.uri)
        expect(threads[0].replies).toEqual([])
    })
})
