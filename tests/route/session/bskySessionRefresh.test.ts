// セッションの再開ミドルウェア（P0・要件 2.1 の「セッション処理」）: 対象の判定、Cookie の無い・壊れた場合の 401、
// 再開の失敗では次の処理を呼ばない、成功時だけ次の処理を呼ぶ
import { describe, expect, it, vi } from "vitest"
import {
    refreshBskySession,
    isManagedByThisMiddleware,
} from "@/lib/session/bskySessionRefresh"
import { encodeBase64Utf8, type OAuthSession } from "@/lib/session/cookies"
import { generateEcJwk } from "@/lib/oauth/jose"
import { TEST_DID, TEST_HANDLE } from "../../fixtures/identities"

const NOW_SECONDS = Math.floor(Date.now() / 1000)

/** Astro のミドルウェアの文脈（必要な項目だけ） */
const contextFor = (path: string, cookie?: string) => ({
    url: new URL(`https://skyshare.test${path}`),
    request: new Request(`https://skyshare.test${path}`, {
        headers: cookie ? { cookie } : {},
    }),
    locals: {} as Record<string, unknown>,
})

const okNext = vi.fn(async () => new Response("handled", { status: 200 }))

const oauthCookie = async (expiresAt: number) => {
    const session = {
        kind: "oauth",
        did: TEST_DID,
        handle: TEST_HANDLE,
        pds: "https://pds.test",
        oauth: {
            accessToken: "access-fixture",
            expiresAt,
            refreshToken: "refresh-fixture",
            dpopJwk: await generateEcJwk(),
            issuer: "https://bsky.social",
            tokenEndpoint: "https://bsky.social/oauth/token",
            clientId: "http://localhost",
        },
    } as unknown as OAuthSession
    return `atp_session=${encodeBase64Utf8(JSON.stringify(session))}`
}

describe("isManagedByThisMiddleware", () => {
    it("manages the v2 API except the session endpoints themselves", () => {
        expect(isManagedByThisMiddleware("/v2/entries")).toBe(true)
        expect(isManagedByThisMiddleware("/v2/bsky/session")).toBe(false)
        expect(isManagedByThisMiddleware("/v2/bsky/session/abc")).toBe(false)
        expect(isManagedByThisMiddleware("/v1/page")).toBe(false)
    })
})

describe("refreshBskySession", () => {
    it("passes requests outside its scope to the next handler without reading the session", async () => {
        okNext.mockClear()
        const res = (await refreshBskySession(
            contextFor("/v1/page") as never,
            okNext as never,
        )) as Response
        expect(okNext).toHaveBeenCalledTimes(1)
        expect(await res.text()).toBe("handled")
    })

    it("returns 401 without calling the next handler when there is no session cookie", async () => {
        okNext.mockClear()
        const res = (await refreshBskySession(
            contextFor("/v2/entries") as never,
            okNext as never,
        )) as Response
        expect(res.status).toBe(401)
        expect(okNext).not.toHaveBeenCalled()
    })

    it("treats a broken session cookie as no session and returns 401", async () => {
        okNext.mockClear()
        const res = (await refreshBskySession(
            contextFor("/v2/entries", "atp_session=!!!broken!!!") as never,
            okNext as never,
        )) as Response
        expect(res.status).toBe(401)
        expect(okNext).not.toHaveBeenCalled()
    })

    it("resumes a fresh OAuth session, sets the locals, and calls the next handler", async () => {
        okNext.mockClear()
        const ctx = contextFor(
            "/v2/entries",
            await oauthCookie(NOW_SECONDS + 3600),
        )
        const res = (await refreshBskySession(
            ctx as never,
            okNext as never,
        )) as Response
        expect(okNext).toHaveBeenCalledTimes(1)
        expect(res.status).toBe(200)
        expect(ctx.locals.session).toEqual({
            did: TEST_DID,
            handle: TEST_HANDLE,
        })
    })

    it("does not call the next handler when an OAuth session cannot be refreshed", async () => {
        okNext.mockClear()
        // 期限が近いので更新に進む。更新の要求を拒否（invalid_grant）させ、次の処理へ進まないことを確かめる
        vi.stubGlobal("fetch", async (input: RequestInfo | URL) =>
            String(input).endsWith("/oauth/token")
                ? new Response(JSON.stringify({ error: "invalid_grant" }), {
                      status: 400,
                      headers: { "content-type": "application/json" },
                  })
                : new Response("{}", { status: 404 }),
        )
        try {
            const res = (await refreshBskySession(
                contextFor(
                    "/v2/entries",
                    await oauthCookie(NOW_SECONDS + 5),
                ) as never,
                okNext as never,
            )) as Response
            expect(res.status).toBeGreaterThanOrEqual(400)
            expect(okNext).not.toHaveBeenCalled()
        } finally {
            vi.unstubAllGlobals()
        }
    })

    it("resumes an app-password session, calls the next handler, and writes the rotated session back", async () => {
        okNext.mockClear()
        const passwordCookie = encodeBase64Utf8(
            JSON.stringify({
                kind: "password",
                service: "https://bsky.social",
                session: {
                    did: TEST_DID,
                    handle: TEST_HANDLE,
                    accessJwt: "a",
                    refreshJwt: "r",
                },
            }),
        )
        // 偽の PDS がトークンをローテーションして返す（resumeSession は必ず refreshSession を呼ぶ）
        vi.stubGlobal("fetch", async (input: RequestInfo | URL) =>
            String(input).includes("/xrpc/com.atproto.server.refreshSession")
                ? new Response(
                      JSON.stringify({
                          accessJwt: "access-rotated",
                          refreshJwt: "refresh-rotated",
                          handle: TEST_HANDLE,
                          did: TEST_DID,
                          active: true,
                      }),
                      {
                          status: 200,
                          headers: { "content-type": "application/json" },
                      },
                  )
                : new Response("{}", { status: 404 }),
        )
        try {
            const ctx = contextFor(
                "/v2/entries",
                `atp_session=${passwordCookie}`,
            )
            const res = (await refreshBskySession(
                ctx as never,
                okNext as never,
            )) as Response
            expect(okNext).toHaveBeenCalledTimes(1)
            expect(res.status).toBe(200)
            expect(await res.text()).toBe("handled")
            expect(ctx.locals.session).toMatchObject({
                did: TEST_DID,
                handle: TEST_HANDLE,
                accessJwt: "access-rotated",
            })
            // ローテーション後のセッションが Set-Cookie として書き戻される
            const cookies = res.headers.getSetCookie()
            expect(cookies).toHaveLength(1)
            expect(cookies[0]).toMatch(/^atp_session=/)
        } finally {
            vi.unstubAllGlobals()
        }
    })

    it("does not call the next handler when an app-password session cannot be resumed", async () => {
        okNext.mockClear()
        const passwordCookie = encodeBase64Utf8(
            JSON.stringify({
                kind: "password",
                service: "https://bsky.social",
                session: {
                    did: TEST_DID,
                    handle: TEST_HANDLE,
                    accessJwt: "a",
                    refreshJwt: "r",
                },
            }),
        )
        // 偽の PDS がセッションの更新を拒否する（期限切れ）ことを明示する
        vi.stubGlobal("fetch", async (input: RequestInfo | URL) =>
            String(input).includes("/xrpc/com.atproto.server.refreshSession")
                ? new Response(JSON.stringify({ error: "ExpiredToken" }), {
                      status: 400,
                      headers: { "content-type": "application/json" },
                  })
                : new Response("{}", { status: 404 }),
        )
        try {
            const res = (await refreshBskySession(
                contextFor(
                    "/v2/entries",
                    `atp_session=${passwordCookie}`,
                ) as never,
                okNext as never,
            )) as Response
            expect(res.status).toBeGreaterThanOrEqual(400)
            expect(okNext).not.toHaveBeenCalled()
        } finally {
            vi.unstubAllGlobals()
        }
    })
})
