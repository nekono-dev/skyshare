// Bluesky の OAuth のログインの完了 API（POST /v2/bsky/session/authorization/completion）の特性化テスト（src-duplicates 1.2・要件 2.1・2.3）。
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

vi.mock("@/lib/session/cookies.js", () => ({
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

describe("Bluesky のログインの完了の応答", () => {
    beforeEach(() => {
        state.result = { ok: true, session: { did: "did:plc:fixture" } }
        state.pool = [{ did: "did:plc:fixture" }]
    })

    it("JSON として読めない本文は 400 と no-store、解除の set-cookie を返す", async () => {
        const res = await call("{not json")
        expect(res.status).toBe(400)
        expect(await res.json()).toEqual({ error: "Bad Request" })
        expect(res.headers.get("cache-control")).toBe("no-store")
        expect(res.headers.getSetCookie()).toEqual(["pending=; Max-Age=0"])
    })

    it("失敗の分類は 200 のまま、分類の値を本文に返し、no-store を付ける", async () => {
        state.result = { ok: false, code: "Denied" }
        const res = await call(validBody)
        expect(res.status).toBe(200)
        expect(await res.json()).toEqual({ result: "Denied" })
        expect(res.headers.get("content-type")).toBe("application/json")
        expect(res.headers.get("cache-control")).toBe("no-store")
        expect(res.headers.getSetCookie()).toEqual(["pending=; Max-Age=0"])
    })

    it("成功は 200 と { result: ok } の本文を返し、セッションと解除の set-cookie を並べる", async () => {
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

    it("アカウント数の上限に達したときは 409 を返す", async () => {
        state.pool = null
        const res = await call(validBody)
        expect(res.status).toBe(409)
        expect(await res.json()).toEqual({ error: "Conflict" })
        expect(res.headers.get("cache-control")).toBe("no-store")
    })
})
