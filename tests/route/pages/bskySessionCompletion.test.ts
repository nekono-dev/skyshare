/**
 * Verifies the Bluesky OAuth completion response.
 */
// 状態・本文・cache-control: no-store・set-cookie（件数）を、現行の値で固定する。振る舞いを変えるためのテストではない。
import { beforeEach, describe, expect, it, vi } from "vitest"

const state = vi.hoisted(() => ({
    result: { ok: true, session: { did: "did:plc:fixture" } } as {
        ok: boolean
        code?: string
        session?: unknown
    },
    pool: [{ did: "did:plc:fixture" }] as unknown[] | null,
}))

vi.mock("@/lib/session/oauthLogin", () => ({
    clearPendingCookie: () => "pending=; Max-Age=0",
    readPendingCookie: () => undefined,
    completeOAuthLogin: async () => state.result,
}))

vi.mock("@/lib/session/cookies", () => ({
    admitSession: () => state.pool,
    makeAccountsSetCookies: () => ["accounts-a=1", "accounts-b=2"],
    makeSessionSetCookie: () => "session=fixture",
    parseAccountsFromRequest: () => [],
    parseSessionFromRequest: () => undefined,
}))

import { POST } from "@/pages/v2/bsky/session/authorization/completion"

const call = (body: string) => {
    const request = new Request(
        "https://skyshare.test/v2/bsky/session/authorization/completion",
        {
            method: "POST",
            headers: { "content-type": "application/json" },
            body,
        },
    )
    return POST({ request, locals: {} } as never)
}

const validBody = JSON.stringify({
    code: "code-fixture",
    state: "state-fixture",
})

describe("Bluesky login completion responses", () => {
    beforeEach(() => {
        state.result = { ok: true, session: { did: "did:plc:fixture" } }
        state.pool = [{ did: "did:plc:fixture" }]
    })

    it("returns 400 with no-store and clears the pending cookie for invalid JSON", async () => {
        const res = await call("{not json")
        expect(res.status).toBe(400)
        expect(await res.json()).toEqual({ error: "Bad Request" })
        expect(res.headers.get("cache-control")).toBe("no-store")
        expect(res.headers.getSetCookie()).toEqual(["pending=; Max-Age=0"])
    })

    it("returns 200 with the failure classification and no-store", async () => {
        state.result = { ok: false, code: "Denied" }
        const res = await call(validBody)
        expect(res.status).toBe(200)
        expect(await res.json()).toEqual({ result: "Denied" })
        expect(res.headers.get("content-type")).toBe("application/json")
        expect(res.headers.get("cache-control")).toBe("no-store")
        expect(res.headers.getSetCookie()).toEqual(["pending=; Max-Age=0"])
    })

    it("returns 200 with an ok result and session cookies after clearing the pending cookie", async () => {
        const res = await call(validBody)
        expect(res.status).toBe(200)
        expect(await res.json()).toEqual({ result: "ok" })
        expect(res.headers.get("cache-control")).toBe("no-store")
        expect(res.headers.getSetCookie()).toEqual([
            "pending=; Max-Age=0",
            "session=fixture",
            "accounts-a=1",
            "accounts-b=2",
            expect.stringMatching(/^[^=]+=/),
        ])
    })

    it("returns 409 when the account limit is reached", async () => {
        state.pool = null
        const res = await call(validBody)
        expect(res.status).toBe(409)
        expect(await res.json()).toEqual({ error: "Conflict" })
        expect(res.headers.get("cache-control")).toBe("no-store")
    })
})
