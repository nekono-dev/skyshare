// 旧投稿の削除（P0・要件 2.1 の「旧投稿削除の OAuth 拒否」）: OAuth のセッションは旧バックエンドへ送らず 403 で拒否する
import { beforeEach, describe, expect, it, vi } from "vitest"

const pagedb = vi.hoisted(() => ({
    deletePageDbEntry: vi.fn(
        async () => ({ ok: true }) as { ok: true } | { error: string },
    ),
}))
vi.mock("@/lib/legacy/pagedb", () => pagedb)

import { DELETE } from "@/pages/v1/page"
import { encodeBase64Utf8 } from "@/lib/session/cookies"
import { TEST_DID, TEST_HANDLE } from "../../fixtures/identities"

const oauthCookie = encodeBase64Utf8(
    JSON.stringify({
        kind: "oauth",
        did: TEST_DID,
        handle: TEST_HANDLE,
        pds: "https://pds.test",
        oauth: {
            accessToken: "access-token-fixture",
            expiresAt: 1_900_000_000,
            refreshToken: "refresh-token-fixture",
            dpopJwk: { kty: "EC", crv: "P-256", x: "x", y: "y" },
            issuer: "https://bsky.social",
            tokenEndpoint: "https://bsky.social/oauth/token",
            clientId: "https://skyshare.test/client-metadata.json",
        },
    }),
)
const passwordCookie = encodeBase64Utf8(
    JSON.stringify({
        kind: "password",
        service: "https://bsky.social",
        session: {
            did: TEST_DID,
            handle: TEST_HANDLE,
            accessJwt: "jwt-fixture",
        },
    }),
)
const validBody = { dbIndex: "legacy", dbKey: "alice.bsky.social@3lxyz" }

const callDelete = (opts: {
    cookie?: string | null
    body?: unknown
    raw?: string
}) => {
    const headers: Record<string, string> = {
        "content-type": "application/json",
    }
    if (opts.cookie !== null)
        headers.cookie = `atp_session=${opts.cookie ?? passwordCookie}`
    const request = new Request("https://skyshare.test/v1/page", {
        method: "DELETE",
        headers,
        body: opts.raw ?? JSON.stringify(opts.body ?? validBody),
    })
    return DELETE({ request } as never)
}

describe("DELETE /v1/page (legacy post deletion)", () => {
    beforeEach(() => {
        pagedb.deletePageDbEntry.mockReset().mockResolvedValue({ ok: true })
        vi.spyOn(console, "warn").mockImplementation(() => {})
        vi.spyOn(console, "error").mockImplementation(() => {})
    })

    it("returns 401 when there is no cookie header", async () => {
        expect((await callDelete({ cookie: null })).status).toBe(401)
        expect(pagedb.deletePageDbEntry).not.toHaveBeenCalled()
    })

    it("returns 400 for a body that is not JSON", async () => {
        expect((await callDelete({ raw: "{not json" })).status).toBe(400)
    })

    it("returns 400 for a body without dbIndex and dbKey strings", async () => {
        expect((await callDelete({ body: { dbIndex: 1 } })).status).toBe(400)
    })

    it("rejects an OAuth session with 403 and never reaches the legacy backend", async () => {
        const res = await callDelete({ cookie: oauthCookie })
        expect(res.status).toBe(403)
        expect(await res.json()).toEqual({ error: "OAuthSessionUnsupported" })
        expect(pagedb.deletePageDbEntry).not.toHaveBeenCalled()
    })

    it("returns 401 when the cookie is a password session without an access token", async () => {
        const noToken = encodeBase64Utf8(
            JSON.stringify({
                kind: "password",
                session: { did: TEST_DID, handle: TEST_HANDLE },
            }),
        )
        expect((await callDelete({ cookie: noToken })).status).toBe(401)
        expect(pagedb.deletePageDbEntry).not.toHaveBeenCalled()
    })

    it("maps the legacy backend's BadRequest to 400", async () => {
        pagedb.deletePageDbEntry.mockResolvedValue({ error: "BadRequest" })
        expect((await callDelete({})).status).toBe(400)
    })

    it("maps the legacy backend's RateLimitExceeded to 429", async () => {
        pagedb.deletePageDbEntry.mockResolvedValue({
            error: "RateLimitExceeded",
        })
        expect((await callDelete({})).status).toBe(429)
    })

    it("maps any other legacy backend failure to 500", async () => {
        pagedb.deletePageDbEntry.mockResolvedValue({ error: "Upstream" })
        expect((await callDelete({})).status).toBe(500)
    })

    it("returns 200 when the password session deletes the entry", async () => {
        const res = await callDelete({})
        expect(res.status).toBe(200)
        expect(pagedb.deletePageDbEntry).toHaveBeenCalledWith({
            dbIndex: "legacy",
            dbKey: "alice.bsky.social@3lxyz",
            did: TEST_DID,
            accessJwt: "jwt-fixture",
        })
    })
})
