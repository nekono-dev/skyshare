import { afterEach, describe, expect, it, vi } from "vitest"
import type { APIContext } from "astro"

import {
    isManagedByThisMiddleware,
    refreshBskySession,
} from "@/lib/session/bskySessionRefresh"
import { encodeBase64Utf8, SESSION_COOKIE_NAME } from "@/lib/session/cookies"

vi.mock("@/lib/atproto/agentFactory", () => ({
    createAtpAgent: vi.fn(),
}))

import { createAtpAgent } from "@/lib/atproto/agentFactory"

const mockedCreateAtpAgent = vi.mocked(createAtpAgent)

afterEach(() => {
    mockedCreateAtpAgent.mockReset()
})

describe("isManagedByThisMiddleware", () => {
    it("[account-session/AC-13] /v2/ 配下は対象", () => {
        expect(isManagedByThisMiddleware("/v2/entry")).toBe(true)
        expect(isManagedByThisMiddleware("/v2/entries")).toBe(true)
    })

    it("[account-session/AC-13] /v2/ 配下以外は対象外", () => {
        expect(isManagedByThisMiddleware("/v1/page")).toBe(false)
        expect(isManagedByThisMiddleware("/")).toBe(false)
    })

    it("[account-session/AC-13] /v2/bsky/session そのものは対象外", () => {
        expect(isManagedByThisMiddleware("/v2/bsky/session")).toBe(false)
    })

    it("[account-session/AC-13] /v2/bsky/session/{did} も対象外", () => {
        expect(isManagedByThisMiddleware("/v2/bsky/session/did:plc:abc")).toBe(
            false,
        )
    })

    it("/v2/bsky/session を含むが別リソースは対象", () => {
        expect(isManagedByThisMiddleware("/v2/bsky/sessions")).toBe(true)
    })
})

describe("refreshBskySession", () => {
    const buildContext = (cookie?: string) =>
        ({
            url: new URL("https://skyshare.nekono.dev/v2/entry"),
            request: new Request("https://skyshare.nekono.dev/v2/entry", {
                headers: cookie ? { cookie } : {},
            }),
            locals: {},
        }) as unknown as APIContext

    it("[account-session/AC-14] 再開に成功すると、更新後のセッションを書き込む Set-Cookie が応答に加わる", async () => {
        const rotated = { did: "did:plc:a", handle: "a.test", accessJwt: "new" }
        mockedCreateAtpAgent.mockReturnValue({
            resumeSession: vi.fn().mockResolvedValue(undefined),
            session: rotated,
        } as any)
        const cookie = `${SESSION_COOKIE_NAME}=${encodeBase64Utf8(
            JSON.stringify({
                session: { did: "did:plc:a", handle: "a.test" },
                service: "https://bsky.social",
            }),
        )}`
        const res = (await refreshBskySession(
            buildContext(cookie),
            async () => new Response("ok", { status: 200 }),
        )) as Response
        expect(res.status).toBe(200)
        const setCookie = res.headers.get("set-cookie") ?? ""
        expect(setCookie).toContain(`${SESSION_COOKIE_NAME}=`)
        expect(setCookie).toContain("HttpOnly")
    })

    it("[account-session/AC-15] セッションの cookie が無いと、後続を呼ばずに 401 で拒否する", async () => {
        const next = vi.fn(async () => new Response("ok"))
        const res = (await refreshBskySession(buildContext(), next)) as Response
        expect(res.status).toBe(401)
        expect(next).not.toHaveBeenCalled()
    })
})
