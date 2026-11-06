// OAuth セッションの更新（P0・要件 2.1 の「セッション処理（トークン更新・書き戻し）」）:
// 期限が近いときだけ更新し、更新は同じアカウントのトークンに限り、失敗の種類を正しい状態コードに写す
import { describe, expect, it, vi } from "vitest"
import {
    ensureFreshOAuthSession,
    resumeOAuthSession,
    type ResumeFailureStatus,
} from "@/lib/session/oauthSession"
import type { OAuthSession } from "@/lib/session/cookies"
import { generateEcJwk } from "@/lib/oauth/jose"
import { TEST_DID, TEST_HANDLE } from "../../fixtures/identities"

const NOW = 1_800_000_000
const TOKEN_ENDPOINT = "https://bsky.social/oauth/token"

/** 公開クライアント（loopback の client_id）のセッション。秘密鍵を使わずに更新できる */
const sessionWith = async (expiresAt: number): Promise<OAuthSession> =>
    ({
        kind: "oauth",
        did: TEST_DID,
        handle: TEST_HANDLE,
        pds: "https://pds.test",
        oauth: {
            accessToken: "access-old",
            expiresAt,
            refreshToken: "refresh-old",
            dpopJwk: await generateEcJwk(),
            issuer: "https://bsky.social",
            tokenEndpoint: TOKEN_ENDPOINT,
            clientId: "http://localhost",
        },
    }) as unknown as OAuthSession

/** 更新の応答を返す偽の fetch（呼ばれた回数を数える） */
const tokenFetch = (reply: () => Response) => {
    const fn = vi.fn(async (input: RequestInfo | URL) => {
        if (String(input) !== TOKEN_ENDPOINT)
            return new Response("unexpected", { status: 404 })
        return reply()
    })
    return { fetchImpl: fn as unknown as typeof fetch, fn }
}

const tokenOk = (sub: string) =>
    new Response(
        JSON.stringify({
            token_type: "DPoP",
            access_token: "access-new",
            refresh_token: "refresh-new",
            sub,
            expires_in: 3600,
        }),
        { status: 200, headers: { "content-type": "application/json" } },
    )
const tokenError = (status: number, error?: string) =>
    new Response(JSON.stringify(error ? { error } : {}), {
        status,
        headers: { "content-type": "application/json" },
    })

const failureStatus = async (
    session: OAuthSession,
    fetchImpl: typeof fetch,
): Promise<ResumeFailureStatus> => {
    const result = await ensureFreshOAuthSession(session, NOW, fetchImpl)
    if (result.ok) throw new Error("expected a failure")
    return result.status
}

describe("ensureFreshOAuthSession", () => {
    it("does not call the token endpoint while the access token is still fresh", async () => {
        const { fetchImpl, fn } = tokenFetch(() => tokenOk(TEST_DID))
        const result = await ensureFreshOAuthSession(
            await sessionWith(NOW + 3600),
            NOW,
            fetchImpl,
        )
        expect(result).toMatchObject({ ok: true, refreshed: false })
        expect(fn).not.toHaveBeenCalled()
    })

    it("refreshes near expiry and keeps the rotated tokens for the same account", async () => {
        const { fetchImpl } = tokenFetch(() => tokenOk(TEST_DID))
        const result = await ensureFreshOAuthSession(
            await sessionWith(NOW + 10),
            NOW,
            fetchImpl,
        )
        if (!result.ok) throw new Error("expected success")
        expect(result.refreshed).toBe(true)
        expect(result.session.oauth.accessToken).toBe("access-new")
        expect(result.session.oauth.refreshToken).toBe("refresh-new")
    })

    it("rejects a refreshed token that belongs to another account (401), so the session never switches owner", async () => {
        const { fetchImpl } = tokenFetch(() =>
            tokenOk("did:plc:testfixturebob00000000000000"),
        )
        expect(
            await failureStatus(await sessionWith(NOW + 10), fetchImpl),
        ).toBe(401)
    })

    it("maps an expired refresh token (invalid_grant) to 401", async () => {
        const { fetchImpl } = tokenFetch(() => tokenError(400, "invalid_grant"))
        expect(
            await failureStatus(await sessionWith(NOW + 10), fetchImpl),
        ).toBe(401)
    })

    it("maps other rejected requests to 401 as well, since the stored token is no longer usable", async () => {
        const { fetchImpl } = tokenFetch(() =>
            tokenError(400, "invalid_client"),
        )
        expect(
            await failureStatus(await sessionWith(NOW + 10), fetchImpl),
        ).toBe(401)
    })

    it("maps rate limiting to 429", async () => {
        const { fetchImpl } = tokenFetch(() => tokenError(429))
        expect(
            await failureStatus(await sessionWith(NOW + 10), fetchImpl),
        ).toBe(429)
    })

    it("maps a server error to 502 (a temporary failure that the caller may retry)", async () => {
        const { fetchImpl } = tokenFetch(() => tokenError(500))
        expect(
            await failureStatus(await sessionWith(NOW + 10), fetchImpl),
        ).toBe(502)
    })

    it("maps a missing client configuration to 500 without calling the network", async () => {
        const { fetchImpl, fn } = tokenFetch(() => tokenOk(TEST_DID))
        const session = await sessionWith(NOW + 10)
        session.oauth.clientId = "https://skyshare.test/client-metadata.json"
        expect(await failureStatus(session, fetchImpl)).toBe(500)
        expect(fn).not.toHaveBeenCalled()
    })
})

describe("resumeOAuthSession", () => {
    it("does not write the session back when the token was not refreshed", async () => {
        const { fetchImpl } = tokenFetch(() => tokenOk(TEST_DID))
        const result = await resumeOAuthSession(
            await sessionWith(NOW + 3600),
            null,
            NOW,
            fetchImpl,
        )
        if (!result.ok) throw new Error("expected success")
        expect(result.collectSetCookies()).toEqual([])
        expect(result.identity).toEqual({ did: TEST_DID, handle: TEST_HANDLE })
    })

    it("writes the session back once after a refresh, so the rotated refresh token is kept", async () => {
        const { fetchImpl } = tokenFetch(() => tokenOk(TEST_DID))
        const result = await resumeOAuthSession(
            await sessionWith(NOW + 10),
            null,
            NOW,
            fetchImpl,
        )
        if (!result.ok) throw new Error("expected success")
        const cookies = result.collectSetCookies()
        expect(cookies.some(c => c.startsWith("atp_session="))).toBe(true)
    })
})

describe("revokeOAuthSession (best effort)", () => {
    it("resolves even when the revocation request cannot be sent, so logout is never blocked", async () => {
        const session = await sessionWith(NOW + 3600)
        session.oauth.revocationEndpoint = "https://bsky.social/oauth/revoke"
        const { revokeOAuthSession } =
            await import("@/lib/session/oauthSession")
        const failing = vi.fn(async () => {
            throw new TypeError("network down")
        })
        await expect(
            revokeOAuthSession(
                session,
                NOW,
                failing as unknown as typeof fetch,
            ),
        ).resolves.toBeUndefined()
    })
})

describe("nonce cookie", () => {
    it("reads the origin and nonce it wrote", async () => {
        const { nonceCookie, readNonceCookie } =
            await import("@/lib/session/oauthSession")
        const setCookie = nonceCookie(
            "https://morel.us-east.host.bsky.network",
            "nonce-fixture",
        )
        const pair = setCookie.slice(0, setCookie.indexOf(";"))
        expect(readNonceCookie(pair)).toEqual({
            origin: "https://morel.us-east.host.bsky.network",
            nonce: "nonce-fixture",
        })
    })

    it("ignores a nonce cookie without the origin and nonce separator", async () => {
        const { readNonceCookie } = await import("@/lib/session/oauthSession")
        expect(readNonceCookie("atp_dpop_nonce=onlyonevalue")).toBeNull()
    })

    it("sets HttpOnly and SameSite=Strict on the nonce cookie", async () => {
        const { nonceCookie } = await import("@/lib/session/oauthSession")
        const setCookie = nonceCookie("https://pds.test", "n")
        expect(setCookie).toContain("HttpOnly")
        expect(setCookie).toContain("SameSite=Strict")
    })
})

describe("resumeOAuthSession (PDS nonce)", () => {
    it("writes back a DPoP nonce that the PDS issued during a request", async () => {
        const session = await sessionWith(NOW + 3600)
        const pdsFetch = vi.fn(
            async (input: RequestInfo | URL, init?: RequestInit) => {
                if (!String(input).startsWith("https://pds.test"))
                    return new Response("unexpected", { status: 404 })
                const dpop = new Headers(init?.headers).get("DPoP") ?? ""
                // 最初の要求は nonce 無しで拒否し、新しい nonce を渡す。二度目は受け付ける
                if (!dpop.includes('"nonce"')) {
                    return new Response(
                        JSON.stringify({ error: "use_dpop_nonce" }),
                        {
                            status: 401,
                            headers: {
                                "content-type": "application/json",
                                "DPoP-Nonce": "nonce-from-pds",
                                "WWW-Authenticate":
                                    'DPoP error="use_dpop_nonce"',
                            },
                        },
                    )
                }
                return new Response(
                    JSON.stringify({ did: TEST_DID, handle: TEST_HANDLE }),
                    {
                        status: 200,
                        headers: { "content-type": "application/json" },
                    },
                )
            },
        )
        const result = await resumeOAuthSession(
            session,
            null,
            NOW,
            pdsFetch as unknown as typeof fetch,
        )
        if (!result.ok) throw new Error("expected success")
        await result.agent.com.atproto.server
            .getSession()
            .catch(() => undefined)
        const cookies = result.collectSetCookies()
        expect(cookies.some(c => c.startsWith("atp_dpop_nonce="))).toBe(true)
    })

    it("resolves the revocation without throwing when the stored key cannot be used", async () => {
        const session = await sessionWith(NOW + 3600)
        session.oauth.dpopJwk = {} as never
        const { revokeOAuthSession } =
            await import("@/lib/session/oauthSession")
        await expect(
            revokeOAuthSession(
                session,
                NOW,
                vi.fn() as unknown as typeof fetch,
            ),
        ).resolves.toBeUndefined()
    })
})

/** DPoP の証明（JWT）のペイロードを読む。検査のための復号であり、検証はしない */
const dpopPayload = (proof: string | undefined): Record<string, unknown> => {
    const middle = (proof ?? "").split(".")[1] ?? ""
    // base64url を標準の base64 に直し、パディングを補ってから復号する
    const base64 = middle.replace(/-/g, "+").replace(/_/g, "/")
    return JSON.parse(
        atob(
            base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "="),
        ),
    ) as Record<string, unknown>
}

describe("resumeOAuthSession (carried nonce cookie)", () => {
    const captureProofs = () => {
        const proofs: (string | undefined)[] = []
        const fetchFn = vi.fn(
            async (input: RequestInfo | URL, init?: RequestInit) => {
                if (!String(input).startsWith("https://pds.test"))
                    return new Response("unexpected", { status: 404 })
                proofs.push(new Headers(init?.headers).get("DPoP") ?? undefined)
                return new Response(
                    JSON.stringify({ did: TEST_DID, handle: TEST_HANDLE }),
                    {
                        status: 200,
                        headers: { "content-type": "application/json" },
                    },
                )
            },
        )
        return { fetchFn: fetchFn as unknown as typeof fetch, proofs }
    }

    it("sends the carried nonce when the cookie is for the same PDS origin", async () => {
        const { fetchFn, proofs } = captureProofs()
        const result = await resumeOAuthSession(
            await sessionWith(NOW + 3600),
            "atp_dpop_nonce=https%3A%2F%2Fpds.test%20carried-nonce",
            NOW,
            fetchFn,
        )
        if (!result.ok) throw new Error("expected success")
        await result.agent.com.atproto.server
            .getSession()
            .catch(() => undefined)
        expect(dpopPayload(proofs[0]).nonce).toBe("carried-nonce")
    })

    it("does not send a carried nonce that was issued for another origin", async () => {
        const { fetchFn, proofs } = captureProofs()
        const result = await resumeOAuthSession(
            await sessionWith(NOW + 3600),
            "atp_dpop_nonce=https%3A%2F%2Fother.test%20carried-nonce",
            NOW,
            fetchFn,
        )
        if (!result.ok) throw new Error("expected success")
        await result.agent.com.atproto.server
            .getSession()
            .catch(() => undefined)
        expect(dpopPayload(proofs[0]).nonce).toBeUndefined()
    })

    it("returns the failure of a refresh instead of an agent, so the request is not sent with a stale token", async () => {
        const { fetchImpl } = tokenFetch(() => tokenError(400, "invalid_grant"))
        const result = await resumeOAuthSession(
            await sessionWith(NOW + 10),
            null,
            NOW,
            fetchImpl,
        )
        expect(result).toEqual({ ok: false, status: 401 })
    })
})
