/**
 * `src/pages/v2/entries/skyshare.ts`(GET /v2/entries/skyshare)の分岐網羅レベルのテスト。
 */
import { describe, expect, it, vi } from "vitest"
import type { APIContext } from "astro"

import { GET } from "@/pages/v2/entries/skyshare"
import { createFakeAgent, fakeSession } from "../testSupport/fakeAgent"

const callRoute = (request: Request, locals: Partial<App.Locals> = {}) =>
    GET({ request, locals } as unknown as APIContext)

const authenticatedLocals = () => ({
    agent: createFakeAgent(),
    session: fakeSession,
})

const makeEntry = (rkey: string, sourceUri: string) => ({
    uri: `at://${fakeSession.did}/dev.nekono.skyshare.entry/${rkey}`,
    cid: `bafy${rkey}`,
    value: {
        source: { uri: sourceUri, cid: `bafysrc${rkey}` },
        manifest: {},
        createdAt: "2024-01-01T00:00:00.000Z",
    },
})

describe("GET /v2/entries/skyshare", () => {
    it("limitが範囲外の場合は400を返す", async () => {
        const request = new Request(
            "https://skyshare.nekono.dev/v2/entries/skyshare/?limit=101",
        )
        const res = await callRoute(request, authenticatedLocals())
        expect(res.status).toBe(400)
    })

    it("未認証の場合は401を返す", async () => {
        const request = new Request(
            "https://skyshare.nekono.dev/v2/entries/skyshare/",
        )
        const res = await callRoute(request, {})
        expect(res.status).toBe(401)
    })

    it("source投稿が現存する場合はorphaned:falseを付与する", async () => {
        const sourceUri = "at://did:plc:author/app.bsky.feed.post/3lalive"
        const listRecords = vi.fn().mockResolvedValue({
            data: {
                records: [makeEntry("3lentry", sourceUri)],
                cursor: undefined,
            },
        })
        const getPosts = vi
            .fn()
            .mockResolvedValue({ data: { posts: [{ uri: sourceUri }] } })
        const agent = createFakeAgent({
            getPosts,
            com: { atproto: { repo: { listRecords } } },
        })
        const request = new Request(
            "https://skyshare.nekono.dev/v2/entries/skyshare/",
        )
        const res = await callRoute(request, { agent, session: fakeSession })
        expect(res.status).toBe(200)
        const json = await res.json()
        expect(json.entries).toHaveLength(1)
        expect(json.entries[0].orphaned).toBe(false)
    })

    it("source投稿が削除済みの場合はorphaned:trueを付与する", async () => {
        const sourceUri = "at://did:plc:author/app.bsky.feed.post/3ldeleted"
        const listRecords = vi.fn().mockResolvedValue({
            data: {
                records: [makeEntry("3lentry", sourceUri)],
                cursor: undefined,
            },
        })
        // getPosts は削除済み投稿のuriを結果に含めない(存在しない扱い)
        const getPosts = vi.fn().mockResolvedValue({ data: { posts: [] } })
        const agent = createFakeAgent({
            getPosts,
            com: { atproto: { repo: { listRecords } } },
        })
        const request = new Request(
            "https://skyshare.nekono.dev/v2/entries/skyshare/",
        )
        const res = await callRoute(request, { agent, session: fakeSession })
        expect(res.status).toBe(200)
        const json = await res.json()
        expect(json.entries[0].orphaned).toBe(true)
    })

    it("atproto呼び出しが失敗した場合はresolveXrpcStatusで正規化したステータスを返す", async () => {
        const listRecords = vi.fn().mockRejectedValue(
            Object.assign(new Error("RepoNotFound"), {
                error: "RepoNotFound",
            }),
        )
        const agent = createFakeAgent({
            com: { atproto: { repo: { listRecords } } },
        })
        const request = new Request(
            "https://skyshare.nekono.dev/v2/entries/skyshare/",
        )
        const res = await callRoute(request, { agent, session: fakeSession })
        expect(res.status).toBe(404)
    })
})
