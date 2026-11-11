/**
 * Verifies schedule credential authorization completion responses.
 */
// 状態・本文（ありとなし）・cache-control: no-store・set-cookie を、現行の値で固定する。振る舞いを変えるためのテストではない。
import { beforeEach, describe, expect, it, vi } from "vitest"

const state = vi.hoisted(() => ({
    result: { ok: true } as { ok: boolean; code?: string },
    throws: false,
}))

vi.mock("@/lib/schedule/env", () => ({
    getScheduleEnv: async () => ({}),
}))
vi.mock("@/lib/schedule/oauth/flow", () => ({
    completeAuthorization: async () => {
        if (state.throws) throw new Error("テスト用の失敗")
        return state.result
    },
}))

import { POST } from "@/pages/v2/schedules/credential/authorization/completion"
import { TEST_DID, TEST_HANDLE } from "../../fixtures/identities"

const call = (opts: { session?: boolean; body?: string }) => {
    const request = new Request(
        "https://skyshare.test/v2/schedules/credential/authorization/completion",
        {
            method: "POST",
            headers: { "content-type": "application/json" },
            body:
                opts.body ??
                JSON.stringify({
                    code: "code-fixture",
                    state: "state-fixture",
                }),
        },
    )
    const locals =
        opts.session === false
            ? {}
            : { session: { did: TEST_DID, handle: TEST_HANDLE } }
    return POST({ request, locals } as never)
}

describe("schedule authorization completion responses", () => {
    beforeEach(() => {
        state.result = { ok: true }
        state.throws = false
    })

    it("returns 401 with no-store when the session is missing", async () => {
        const res = await call({ session: false })
        expect(res.status).toBe(401)
        expect(await res.json()).toEqual({ error: "Unauthorized" })
        expect(res.headers.get("cache-control")).toBe("no-store")
    })

    it("returns 400 for a body that is not valid JSON", async () => {
        const res = await call({ body: "{not json" })
        expect(res.status).toBe(400)
        expect(await res.json()).toEqual({ error: "Bad Request" })
    })

    it("returns 400 when the body contains unknown fields", async () => {
        const res = await call({ body: JSON.stringify({ unknown: 1 }) })
        expect(res.status).toBe(400)
    })

    it("returns 200 with an ok result, no-store, and an expired hint cookie", async () => {
        const res = await call({})
        expect(res.status).toBe(200)
        expect(await res.json()).toEqual({ result: "ok" })
        expect(res.headers.get("content-type")).toBe("application/json")
        expect(res.headers.get("cache-control")).toBe("no-store")
        const cookies = res.headers.getSetCookie()
        expect(cookies).toHaveLength(1)
        expect(cookies[0]).toMatch(/^[^=]+=/)
    })

    it("returns 200 with the failure classification in the body", async () => {
        state.result = { ok: false, code: "Denied" }
        const res = await call({})
        expect(res.status).toBe(200)
        expect(await res.json()).toEqual({ result: "Denied" })
        expect(res.headers.getSetCookie()).toHaveLength(1)
    })

    it("returns 500 for an unexpected exception", async () => {
        state.throws = true
        const res = await call({})
        expect(res.status).toBe(500)
        expect(await res.json()).toEqual({ error: "Internal Server Error" })
    })
})
