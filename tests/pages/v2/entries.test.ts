/**
 * `src/pages/v2/entries.ts`(GET /v2/entries)の分岐網羅レベルのテスト。
 */
import { describe, expect, it, vi } from "vitest"
import type { APIContext } from "astro"

import { GET } from "@/pages/v2/entries"
import { createFakeAgent, fakeSession } from "./testSupport/fakeAgent"

const callRoute = (request: Request, locals: Partial<App.Locals> = {}) =>
    GET({ request, locals } as unknown as APIContext)

const authenticatedLocals = () => ({
    agent: createFakeAgent(),
    session: fakeSession,
})

describe("GET /v2/entries", () => {
    it("limitが範囲外の場合は400を返す", async () => {
        const request = new Request(
            "https://skyshare.nekono.dev/v2/entries/?limit=0",
        )
        const res = await callRoute(request, authenticatedLocals())
        expect(res.status).toBe(400)
    })

    it("未認証の場合は401を返す", async () => {
        const request = new Request("https://skyshare.nekono.dev/v2/entries/")
        const res = await callRoute(request, {})
        expect(res.status).toBe(401)
    })

    it("リポストを除外し、自分の投稿のみをthreads配列として返す", async () => {
        const ownPost = {
            post: {
                uri: "at://did:plc:author/app.bsky.feed.post/3lown",
                cid: "bafyown",
                indexedAt: "2024-01-01T00:00:00.000Z",
                author: { did: fakeSession.did, handle: fakeSession.handle },
                record: { text: "own post" },
            },
        }
        const repostedPost = {
            post: {
                uri: "at://did:plc:other/app.bsky.feed.post/3lother",
                cid: "bafyother",
                indexedAt: "2024-01-01T00:00:00.000Z",
                author: { did: "did:plc:other", handle: "other.bsky.social" },
                record: { text: "reposted" },
            },
        }
        const getAuthorFeed = vi.fn().mockResolvedValue({
            data: { feed: [repostedPost, ownPost], cursor: undefined },
        })
        const agent = createFakeAgent({ getAuthorFeed })
        const request = new Request("https://skyshare.nekono.dev/v2/entries/")
        const res = await callRoute(request, { agent, session: fakeSession })
        expect(res.status).toBe(200)
        const json = await res.json()
        expect(json.threads).toHaveLength(1)
        expect(json.threads[0].rootPost.uri).toBe(ownPost.post.uri)
    })

    it("1ページ目がlimit未満の場合はcursorを辿って追加ページを取得する", async () => {
        const makeOwnPost = (rkey: string) => ({
            post: {
                uri: `at://did:plc:author/app.bsky.feed.post/${rkey}`,
                cid: `bafy${rkey}`,
                indexedAt: "2024-01-01T00:00:00.000Z",
                author: { did: fakeSession.did, handle: fakeSession.handle },
                record: { text: rkey },
            },
        })
        const getAuthorFeed = vi
            .fn()
            .mockResolvedValueOnce({
                data: { feed: [makeOwnPost("p1")], cursor: "page2" },
            })
            .mockResolvedValueOnce({
                data: { feed: [makeOwnPost("p2")], cursor: undefined },
            })
        const agent = createFakeAgent({ getAuthorFeed })
        const request = new Request(
            "https://skyshare.nekono.dev/v2/entries/?limit=2",
        )
        const res = await callRoute(request, { agent, session: fakeSession })
        expect(res.status).toBe(200)
        const json = await res.json()
        expect(json.threads).toHaveLength(2)
        expect(getAuthorFeed).toHaveBeenCalledTimes(2)
    })

    it("紐づくskyshare entryをsource.uriで突き合わせて付与する", async () => {
        const postUri = "at://did:plc:author/app.bsky.feed.post/3lown"
        const getAuthorFeed = vi.fn().mockResolvedValue({
            data: {
                feed: [
                    {
                        post: {
                            uri: postUri,
                            cid: "bafyown",
                            indexedAt: "2024-01-01T00:00:00.000Z",
                            author: {
                                did: fakeSession.did,
                                handle: fakeSession.handle,
                            },
                            record: { text: "own post" },
                        },
                    },
                ],
                cursor: undefined,
            },
        })
        const listRecords = vi.fn().mockResolvedValue({
            data: {
                records: [
                    {
                        uri: "at://did:plc:author/dev.nekono.skyshare.entry/3lentry",
                        cid: "bafyentry",
                        value: {
                            source: { uri: postUri, cid: "bafyown" },
                            manifest: {},
                            createdAt: "2024-01-01T00:00:00.000Z",
                        },
                    },
                ],
                cursor: undefined,
            },
        })
        const agent = createFakeAgent({
            getAuthorFeed,
            com: { atproto: { repo: { listRecords } } },
        })
        const request = new Request("https://skyshare.nekono.dev/v2/entries/")
        const res = await callRoute(request, { agent, session: fakeSession })
        expect(res.status).toBe(200)
        const json = await res.json()
        expect(json.threads[0].rootPost.skyshareEntry.sourceUri).toBe(postUri)
    })

    it("getAuthorFeedがスレッド中間の投稿を欠落させた場合、getPostThreadで補って1つのThreadGroupにまとめる", async () => {
        // 実際に観測された不具合の再現: getAuthorFeedのレスポンスに"root"(test)と
        // "tail"(test3、record.replyは一覧に無い"mid"を指す)のみが含まれ、
        // "mid"(test2)自体が欠落しているケース。
        const rootUri = "at://did:plc:author/app.bsky.feed.post/3lroot"
        const midUri = "at://did:plc:author/app.bsky.feed.post/3lmid"
        const tailUri = "at://did:plc:author/app.bsky.feed.post/3ltail"
        const author = { did: fakeSession.did, handle: fakeSession.handle }

        const rootFeedItem = {
            post: {
                uri: rootUri,
                cid: "bafyroot",
                indexedAt: "2024-01-01T00:00:00.000Z",
                author,
                record: { text: "test" },
            },
        }
        const tailFeedItem = {
            post: {
                uri: tailUri,
                cid: "bafytail",
                indexedAt: "2024-01-01T00:02:00.000Z",
                author,
                record: {
                    text: "test3",
                    reply: {
                        parent: { uri: midUri, cid: "bafymid" },
                        root: { uri: rootUri, cid: "bafyroot" },
                    },
                },
            },
        }

        const getAuthorFeed = vi.fn().mockResolvedValue({
            data: { feed: [tailFeedItem, rootFeedItem], cursor: undefined },
        })
        const getPostThread = vi.fn().mockResolvedValue({
            data: {
                thread: {
                    $type: "app.bsky.feed.defs#threadViewPost",
                    post: rootFeedItem.post,
                    replies: [
                        {
                            $type: "app.bsky.feed.defs#threadViewPost",
                            post: {
                                uri: midUri,
                                cid: "bafymid",
                                indexedAt: "2024-01-01T00:01:00.000Z",
                                author,
                                record: {
                                    text: "test2",
                                    reply: {
                                        parent: {
                                            uri: rootUri,
                                            cid: "bafyroot",
                                        },
                                        root: { uri: rootUri, cid: "bafyroot" },
                                    },
                                },
                            },
                            replies: [
                                {
                                    $type: "app.bsky.feed.defs#threadViewPost",
                                    post: tailFeedItem.post,
                                    replies: [],
                                },
                            ],
                        },
                    ],
                },
            },
        })
        const agent = createFakeAgent({
            getAuthorFeed,
            app: { bsky: { feed: { getPostThread } } },
        })
        const request = new Request("https://skyshare.nekono.dev/v2/entries/")
        const res = await callRoute(request, { agent, session: fakeSession })
        expect(res.status).toBe(200)
        const json = await res.json()

        expect(getPostThread).toHaveBeenCalledWith(
            expect.objectContaining({ uri: rootUri }),
        )
        expect(json.threads).toHaveLength(1)
        expect(json.threads[0].rootPost.uri).toBe(rootUri)
        expect(
            json.threads[0].replies.map((post: { uri: string }) => post.uri),
        ).toEqual([midUri, tailUri])
    })

    it("root投稿は残るが後続投稿がすべて欠落する場合でも、replyCountを手がかりに補完する", async () => {
        // root(test)のみがgetAuthorFeedに含まれ、その後続(test2/test3)は
        // 1件もfeedに現れないケース（gap検出方式では検知不可能だった、より重度な欠落）。
        const rootUri = "at://did:plc:author/app.bsky.feed.post/3lroot"
        const midUri = "at://did:plc:author/app.bsky.feed.post/3lmid"
        const tailUri = "at://did:plc:author/app.bsky.feed.post/3ltail"
        const author = { did: fakeSession.did, handle: fakeSession.handle }

        const rootFeedItem = {
            post: {
                uri: rootUri,
                cid: "bafyroot",
                indexedAt: "2024-01-01T00:00:00.000Z",
                author,
                record: { text: "test" },
                replyCount: 1,
            },
        }

        const getAuthorFeed = vi.fn().mockResolvedValue({
            data: { feed: [rootFeedItem], cursor: undefined },
        })
        const getPostThread = vi.fn().mockResolvedValue({
            data: {
                thread: {
                    $type: "app.bsky.feed.defs#threadViewPost",
                    post: rootFeedItem.post,
                    replies: [
                        {
                            $type: "app.bsky.feed.defs#threadViewPost",
                            post: {
                                uri: midUri,
                                cid: "bafymid",
                                indexedAt: "2024-01-01T00:01:00.000Z",
                                author,
                                record: { text: "test2" },
                            },
                            replies: [
                                {
                                    $type: "app.bsky.feed.defs#threadViewPost",
                                    post: {
                                        uri: tailUri,
                                        cid: "bafytail",
                                        indexedAt: "2024-01-01T00:02:00.000Z",
                                        author,
                                        record: { text: "test3" },
                                    },
                                    replies: [],
                                },
                            ],
                        },
                    ],
                },
            },
        })
        const agent = createFakeAgent({
            getAuthorFeed,
            app: { bsky: { feed: { getPostThread } } },
        })
        const request = new Request("https://skyshare.nekono.dev/v2/entries/")
        const res = await callRoute(request, { agent, session: fakeSession })
        expect(res.status).toBe(200)
        const json = await res.json()

        expect(getPostThread).toHaveBeenCalledWith(
            expect.objectContaining({ uri: rootUri }),
        )
        expect(json.threads).toHaveLength(1)
        expect(json.threads[0].rootPost.uri).toBe(rootUri)
        expect(
            json.threads[0].replies.map((post: { uri: string }) => post.uri),
        ).toEqual([midUri, tailUri])
    })

    it("分岐スレッドは、採用した1系統のThreadGroupのみを返し、採用されなかった側はTimelineに含めない", async () => {
        const rootUri = "at://did:plc:author/app.bsky.feed.post/3lroot"
        const nearUri = "at://did:plc:author/app.bsky.feed.post/3lnear"
        const farUri = "at://did:plc:author/app.bsky.feed.post/3lfar"
        const author = { did: fakeSession.did, handle: fakeSession.handle }

        const rootFeedItem = {
            post: {
                uri: rootUri,
                cid: "bafyroot",
                indexedAt: "2024-01-01T00:00:00.000Z",
                author,
                record: {
                    text: "root",
                    createdAt: "2024-01-01T00:00:00.000Z",
                },
                replyCount: 2,
            },
        }
        const nearFeedItem = {
            post: {
                uri: nearUri,
                cid: "bafynear",
                indexedAt: "2024-01-01T00:00:05.000Z",
                author,
                record: {
                    text: "near",
                    createdAt: "2024-01-01T00:00:05.000Z",
                    reply: {
                        parent: { uri: rootUri, cid: "bafyroot" },
                        root: { uri: rootUri, cid: "bafyroot" },
                    },
                },
            },
        }
        const farFeedItem = {
            post: {
                uri: farUri,
                cid: "bafyfar",
                indexedAt: "2024-01-05T00:00:00.000Z",
                author,
                record: {
                    text: "far",
                    createdAt: "2024-01-05T00:00:00.000Z",
                    reply: {
                        parent: { uri: rootUri, cid: "bafyroot" },
                        root: { uri: rootUri, cid: "bafyroot" },
                    },
                },
            },
        }

        const getAuthorFeed = vi.fn().mockResolvedValue({
            data: {
                feed: [farFeedItem, nearFeedItem, rootFeedItem],
                cursor: undefined,
            },
        })
        const getPostThread = vi.fn().mockResolvedValue({
            data: {
                thread: {
                    $type: "app.bsky.feed.defs#threadViewPost",
                    post: rootFeedItem.post,
                    replies: [
                        {
                            $type: "app.bsky.feed.defs#threadViewPost",
                            post: farFeedItem.post,
                            replies: [],
                        },
                        {
                            $type: "app.bsky.feed.defs#threadViewPost",
                            post: nearFeedItem.post,
                            replies: [],
                        },
                    ],
                },
            },
        })
        const agent = createFakeAgent({
            getAuthorFeed,
            app: { bsky: { feed: { getPostThread } } },
        })
        const request = new Request("https://skyshare.nekono.dev/v2/entries/")
        const res = await callRoute(request, { agent, session: fakeSession })
        expect(res.status).toBe(200)
        const json = await res.json()

        expect(json.threads).toHaveLength(1)
        expect(json.threads[0].rootPost.uri).toBe(rootUri)
        expect(
            json.threads[0].replies.map((post: { uri: string }) => post.uri),
        ).toEqual([nearUri])
    })

    it("atproto呼び出しが失敗した場合はresolveXrpcStatusで正規化したステータスを返す", async () => {
        const getAuthorFeed = vi.fn().mockRejectedValue(
            Object.assign(new Error("AuthenticationRequired"), {
                error: "AuthenticationRequired",
            }),
        )
        const agent = createFakeAgent({ getAuthorFeed })
        const request = new Request("https://skyshare.nekono.dev/v2/entries/")
        const res = await callRoute(request, { agent, session: fakeSession })
        expect(res.status).toBe(401)
    })
})
