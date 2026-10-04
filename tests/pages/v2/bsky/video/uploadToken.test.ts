/**
 * `src/pages/v2/bsky/video/upload-token.ts`(POST /v2/bsky/video/upload-token)のテスト。
 */
import { describe, expect, it, vi } from "vitest"
import type { APIContext } from "astro"

import { POST } from "@/pages/v2/bsky/video/upload-token"

const callRoute = (locals: Partial<App.Locals>) =>
    POST({ locals } as unknown as APIContext)

const makeSession = (endpoint: string) => ({
    did: "did:plc:me",
    didDoc: {
        service: [
            {
                id: "#atproto_pds",
                type: "AtprotoPersonalDataServer",
                serviceEndpoint: endpoint,
            },
        ],
    },
})

const makeAgent = () =>
    ({
        com: {
            atproto: {
                server: {
                    getServiceAuth: vi
                        .fn()
                        .mockResolvedValue({ data: { token: "secret-token" } }),
                },
            },
        },
    }) as any

describe("POST /v2/bsky/video/upload-token", () => {
    it("未認証は 401", async () => {
        const res = await callRoute({})
        expect(res.status).toBe(401)
    })

    it("対応PDSは 200 でトークンを返し、キャッシュさせない", async () => {
        const res = await callRoute({
            agent: makeAgent(),
            session: makeSession("https://bsky.social") as any,
        })
        expect(res.status).toBe(200)
        expect(res.headers.get("cache-control")).toBe("no-store")
        const body = await res.json()
        expect(body).toMatchObject({ token: "secret-token", did: "did:plc:me" })
        expect(typeof body.expiresAt).toBe("number")
    })

    it("対応外PDSは 400", async () => {
        const res = await callRoute({
            agent: makeAgent(),
            session: makeSession("https://example.com") as any,
        })
        expect(res.status).toBe(400)
    })
})
