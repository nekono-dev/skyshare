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

    it("リポストを除外し、自分の投稿のみをposts配列として返す", async () => {
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
        expect(json.posts).toHaveLength(1)
        expect(json.posts[0].uri).toBe(ownPost.post.uri)
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
        expect(json.posts).toHaveLength(2)
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
        expect(json.posts[0].skyshareEntry.sourceUri).toBe(postUri)
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
