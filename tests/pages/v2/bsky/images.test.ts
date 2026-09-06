/**
 * `src/pages/v2/bsky/images.ts`(GET /v2/bsky/images)の分岐網羅レベルのテスト。
 */
import { describe, expect, it, vi } from "vitest"
import type { APIContext } from "astro"

import { GET } from "@/pages/v2/bsky/images"
import { createFakeAgent, fakeSession } from "../testSupport/fakeAgent"

const callRoute = (request: Request, locals: Partial<App.Locals> = {}) =>
    GET({ request, locals } as unknown as APIContext)

describe("GET /v2/bsky/images", () => {
    it("未認証の場合は401を返す", async () => {
        const request = new Request(
            "https://skyshare.nekono.dev/v2/bsky/images/?cid=bafkreiabc",
        )
        const res = await callRoute(request, {})
        expect(res.status).toBe(401)
    })

    it("cidが未指定の場合は400を返す", async () => {
        const request = new Request(
            "https://skyshare.nekono.dev/v2/bsky/images/",
        )
        const res = await callRoute(request, {
            agent: createFakeAgent(),
            session: fakeSession,
        })
        expect(res.status).toBe(400)
    })

    it("cidが空文字の場合は400を返す", async () => {
        const request = new Request(
            "https://skyshare.nekono.dev/v2/bsky/images/?cid=%20",
        )
        const res = await callRoute(request, {
            agent: createFakeAgent(),
            session: fakeSession,
        })
        expect(res.status).toBe(400)
    })

    it("成功時は上流のContent-Typeを引き継いだ画像バイナリを返す", async () => {
        const getBlob = vi.fn().mockResolvedValue({
            data: new Uint8Array([1, 2, 3, 4]),
            headers: { "content-type": "image/webp" },
        })
        const agent = createFakeAgent({
            com: { atproto: { sync: { getBlob } } },
        })
        const request = new Request(
            "https://skyshare.nekono.dev/v2/bsky/images/?cid=bafkreiabc",
        )
        const res = await callRoute(request, { agent, session: fakeSession })
        expect(res.status).toBe(200)
        expect(res.headers.get("content-type")).toBe("image/webp")
        const buf = new Uint8Array(await res.arrayBuffer())
        expect(Array.from(buf)).toEqual([1, 2, 3, 4])
    })

    it("上流にContent-Typeが無い場合はoctet-streamにフォールバックする", async () => {
        const getBlob = vi.fn().mockResolvedValue({
            data: new Uint8Array([1]),
            headers: {},
        })
        const agent = createFakeAgent({
            com: { atproto: { sync: { getBlob } } },
        })
        const request = new Request(
            "https://skyshare.nekono.dev/v2/bsky/images/?cid=bafkreiabc",
        )
        const res = await callRoute(request, { agent, session: fakeSession })
        expect(res.status).toBe(200)
        expect(res.headers.get("content-type")).toBe("application/octet-stream")
    })

    it("blobが見つからない場合はresolveXrpcStatusにより404を返す", async () => {
        const getBlob = vi.fn().mockRejectedValue(
            Object.assign(new Error("BlobNotFound"), {
                error: "BlobNotFound",
            }),
        )
        const agent = createFakeAgent({
            com: { atproto: { sync: { getBlob } } },
        })
        const request = new Request(
            "https://skyshare.nekono.dev/v2/bsky/images/?cid=bafkreiabc",
        )
        const res = await callRoute(request, { agent, session: fakeSession })
        expect(res.status).toBe(404)
    })
})
