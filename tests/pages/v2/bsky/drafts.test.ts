/**
 * `src/pages/v2/bsky/drafts.ts`(GET/POST/PUT/DELETE /v2/bsky/drafts)の
 * 分岐網羅レベルのテスト。
 */
import { describe, expect, it, vi } from "vitest"
import type { APIContext } from "astro"

import { GET, POST, PUT, DELETE } from "@/pages/v2/bsky/drafts"
import { createFakeAgent } from "../testSupport/fakeAgent"

const callRoute = (
    handler: typeof GET,
    request: Request,
    locals: Partial<App.Locals> = {},
) => handler({ request, locals } as unknown as APIContext)

const authenticatedLocals = () => ({ agent: createFakeAgent() })

describe("GET /v2/bsky/drafts", () => {
    it("未認証の場合は401を返す", async () => {
        const request = new Request(
            "https://skyshare.nekono.dev/v2/bsky/drafts/",
        )
        const res = await callRoute(GET, request, {})
        expect(res.status).toBe(401)
    })

    it("limitが範囲外の場合は400を返す", async () => {
        const request = new Request(
            "https://skyshare.nekono.dev/v2/bsky/drafts/?limit=0",
        )
        const res = await callRoute(GET, request, authenticatedLocals())
        expect(res.status).toBe(400)
    })

    it("cursorが空文字の場合は400を返す", async () => {
        const request = new Request(
            "https://skyshare.nekono.dev/v2/bsky/drafts/?cursor=",
        )
        const res = await callRoute(GET, request, authenticatedLocals())
        expect(res.status).toBe(400)
    })

    it("getDraftsのレスポンスが不正な形の場合は500を返す", async () => {
        const getDrafts = vi
            .fn()
            .mockResolvedValue({ data: { drafts: [{ id: "missing-fields" }] } })
        const agent = createFakeAgent({
            app: { bsky: { draft: { getDrafts } } },
        })
        const request = new Request(
            "https://skyshare.nekono.dev/v2/bsky/drafts/",
        )
        const res = await callRoute(GET, request, { agent })
        expect(res.status).toBe(500)
    })

    it("成功時は200でdrafts一覧を返す", async () => {
        const getDrafts = vi.fn().mockResolvedValue({
            data: {
                cursor: "next",
                drafts: [
                    {
                        id: "3ldrafttid",
                        createdAt: "2024-01-01T00:00:00.000Z",
                        updatedAt: "2024-01-01T00:00:00.000Z",
                        draft: { posts: [{ text: "hello" }] },
                    },
                ],
            },
        })
        const agent = createFakeAgent({
            app: { bsky: { draft: { getDrafts } } },
        })
        const request = new Request(
            "https://skyshare.nekono.dev/v2/bsky/drafts/",
        )
        const res = await callRoute(GET, request, { agent })
        expect(res.status).toBe(200)
        const json = await res.json()
        expect(json.drafts[0].posts).toEqual([{ text: "hello" }])
    })

    it("posts複数件(スレッド下書き)も一覧に含めて返す", async () => {
        const getDrafts = vi.fn().mockResolvedValue({
            data: {
                drafts: [
                    {
                        id: "3lthreaddraft",
                        createdAt: "2024-01-01T00:00:00.000Z",
                        updatedAt: "2024-01-01T00:00:00.000Z",
                        draft: {
                            posts: [
                                { text: "スレッド1" },
                                { text: "スレッド2" },
                            ],
                        },
                    },
                ],
            },
        })
        const agent = createFakeAgent({
            app: { bsky: { draft: { getDrafts } } },
        })
        const request = new Request(
            "https://skyshare.nekono.dev/v2/bsky/drafts/",
        )
        const res = await callRoute(GET, request, { agent })
        expect(res.status).toBe(200)
        const json = await res.json()
        expect(json.drafts[0].posts).toEqual([
            { text: "スレッド1" },
            { text: "スレッド2" },
        ])
    })

    it("atproto呼び出しが失敗した場合はresolveXrpcStatusで正規化したステータスを返す", async () => {
        const getDrafts = vi.fn().mockRejectedValue(
            Object.assign(new Error("RateLimitExceeded"), {
                error: "RateLimitExceeded",
            }),
        )
        const agent = createFakeAgent({
            app: { bsky: { draft: { getDrafts } } },
        })
        const request = new Request(
            "https://skyshare.nekono.dev/v2/bsky/drafts/",
        )
        const res = await callRoute(GET, request, { agent })
        expect(res.status).toBe(429)
    })
})

describe("POST /v2/bsky/drafts", () => {
    it("未認証の場合は401を返す", async () => {
        const request = new Request(
            "https://skyshare.nekono.dev/v2/bsky/drafts/",
            {
                method: "POST",
                body: JSON.stringify({ posts: [{ text: "hello" }] }),
            },
        )
        const res = await callRoute(POST, request, {})
        expect(res.status).toBe(401)
    })

    it("bodyがスキーマ不正(posts欠落)の場合は400を返す", async () => {
        const request = new Request(
            "https://skyshare.nekono.dev/v2/bsky/drafts/",
            { method: "POST", body: JSON.stringify({}) },
        )
        const res = await callRoute(POST, request, authenticatedLocals())
        expect(res.status).toBe(400)
    })

    it("postsが空配列の場合は400を返す", async () => {
        const request = new Request(
            "https://skyshare.nekono.dev/v2/bsky/drafts/",
            { method: "POST", body: JSON.stringify({ posts: [] }) },
        )
        const res = await callRoute(POST, request, authenticatedLocals())
        expect(res.status).toBe(400)
    })

    it("成功時は200で{id}を返す", async () => {
        const request = new Request(
            "https://skyshare.nekono.dev/v2/bsky/drafts/",
            {
                method: "POST",
                body: JSON.stringify({ posts: [{ text: "hello" }] }),
            },
        )
        const res = await callRoute(POST, request, authenticatedLocals())
        expect(res.status).toBe(200)
        const json = await res.json()
        expect(json.id).toBe("3ldrafttid")
    })

    it("posts複数件(スレッド下書き)を新規作成できる", async () => {
        const createDraft = vi.fn().mockResolvedValue({
            data: { id: "3lthreaddraft" },
        })
        const agent = createFakeAgent({
            app: { bsky: { draft: { createDraft } } },
        })
        const request = new Request(
            "https://skyshare.nekono.dev/v2/bsky/drafts/",
            {
                method: "POST",
                body: JSON.stringify({
                    posts: [{ text: "スレッド1" }, { text: "スレッド2" }],
                }),
            },
        )
        const res = await callRoute(POST, request, { agent })
        expect(res.status).toBe(200)
        expect(createDraft).toHaveBeenCalledWith(
            expect.objectContaining({
                draft: {
                    posts: [
                        { text: "スレッド1", labels: undefined },
                        { text: "スレッド2", labels: undefined },
                    ],
                },
            }),
        )
    })

    it("atproto呼び出しが失敗した場合はresolveXrpcStatusで正規化したステータスを返す", async () => {
        const createDraft = vi.fn().mockRejectedValue(
            Object.assign(new Error("DraftLimitReached"), {
                error: "DraftLimitReached",
            }),
        )
        const agent = createFakeAgent({
            app: { bsky: { draft: { createDraft } } },
        })
        const request = new Request(
            "https://skyshare.nekono.dev/v2/bsky/drafts/",
            {
                method: "POST",
                body: JSON.stringify({ posts: [{ text: "hello" }] }),
            },
        )
        const res = await callRoute(POST, request, { agent })
        expect(res.status).toBe(429)
    })
})

describe("PUT /v2/bsky/drafts", () => {
    it("未認証の場合は401を返す", async () => {
        const request = new Request(
            "https://skyshare.nekono.dev/v2/bsky/drafts/",
            {
                method: "PUT",
                body: JSON.stringify({
                    id: "3ldrafttid",
                    posts: [{ text: "hello" }],
                }),
            },
        )
        const res = await callRoute(PUT, request, {})
        expect(res.status).toBe(401)
    })

    it("bodyがスキーマ不正(id欠落)の場合は400を返す", async () => {
        const request = new Request(
            "https://skyshare.nekono.dev/v2/bsky/drafts/",
            {
                method: "PUT",
                body: JSON.stringify({ posts: [{ text: "hello" }] }),
            },
        )
        const res = await callRoute(PUT, request, authenticatedLocals())
        expect(res.status).toBe(400)
    })

    it("成功時は200(本文なし)を返す", async () => {
        const request = new Request(
            "https://skyshare.nekono.dev/v2/bsky/drafts/",
            {
                method: "PUT",
                body: JSON.stringify({
                    id: "3ldrafttid",
                    posts: [{ text: "hello" }],
                }),
            },
        )
        const res = await callRoute(PUT, request, authenticatedLocals())
        expect(res.status).toBe(200)
    })

    it("posts複数件(スレッド下書き)へ更新できる", async () => {
        const updateDraft = vi.fn().mockResolvedValue({ data: {} })
        const agent = createFakeAgent({
            app: { bsky: { draft: { updateDraft } } },
        })
        const request = new Request(
            "https://skyshare.nekono.dev/v2/bsky/drafts/",
            {
                method: "PUT",
                body: JSON.stringify({
                    id: "3lthreaddraft",
                    posts: [{ text: "スレッド1" }, { text: "スレッド2" }],
                }),
            },
        )
        const res = await callRoute(PUT, request, { agent })
        expect(res.status).toBe(200)
        expect(updateDraft).toHaveBeenCalledWith(
            expect.objectContaining({
                draft: expect.objectContaining({
                    id: "3lthreaddraft",
                    draft: {
                        posts: [
                            { text: "スレッド1", labels: undefined },
                            { text: "スレッド2", labels: undefined },
                        ],
                    },
                }),
            }),
        )
    })
})

describe("DELETE /v2/bsky/drafts", () => {
    it("未認証の場合は401を返す", async () => {
        const request = new Request(
            "https://skyshare.nekono.dev/v2/bsky/drafts/",
            { method: "DELETE", body: JSON.stringify({ id: "3ldrafttid" }) },
        )
        const res = await callRoute(DELETE, request, {})
        expect(res.status).toBe(401)
    })

    it("bodyがスキーマ不正(id欠落)の場合は400を返す", async () => {
        const request = new Request(
            "https://skyshare.nekono.dev/v2/bsky/drafts/",
            { method: "DELETE", body: JSON.stringify({}) },
        )
        const res = await callRoute(DELETE, request, authenticatedLocals())
        expect(res.status).toBe(400)
    })

    it("成功時は200(本文なし)を返す", async () => {
        const request = new Request(
            "https://skyshare.nekono.dev/v2/bsky/drafts/",
            { method: "DELETE", body: JSON.stringify({ id: "3ldrafttid" }) },
        )
        const res = await callRoute(DELETE, request, authenticatedLocals())
        expect(res.status).toBe(200)
    })
})
