/**
 * Verifies OAuth login validation and session creation.
 */
// アカウントの確認の失敗は、いずれもセッションを作らずに失敗の種類で返す
import { describe, expect, it, vi } from "vitest"
import {
    completeOAuthLogin,
    startOAuthLogin,
    type PendingLogin,
} from "@/lib/session/oauthLogin"
import { generateEcJwk } from "@/lib/oauth/jose"
import { TEST_DID } from "../../fixtures/identities"

const NOW = 1_800_000_000
const TOKEN_ENDPOINT = "https://bsky.social/oauth/token"

const pendingFor = async (
    clientId = "http://localhost",
): Promise<PendingLogin> => ({
    state: "state-fixture",
    verifier: "verifier-fixture-0123456789012345678901234567890",
    dpopJwk: await generateEcJwk(),
    issuer: "https://bsky.social",
    tokenEndpoint: TOKEN_ENDPOINT,
    clientId,
    redirectUri: "http://localhost/oauth/callback",
})

const json = (status: number, body: unknown) =>
    new Response(JSON.stringify(body), {
        status,
        headers: { "content-type": "application/json" },
    })

describe("completeOAuthLogin (callback checks)", () => {
    it("fails with Denied when the authorization server returned an error", async () => {
        const result = await completeOAuthLogin({
            pending: await pendingFor(),
            query: { error: "access_denied" },
            now: NOW,
        })
        expect(result).toEqual({ ok: false, code: "Denied" })
    })

    it("fails with StateInvalid when the state does not match the pending login (possible forged callback)", async () => {
        const result = await completeOAuthLogin({
            pending: await pendingFor(),
            query: {
                code: "c",
                state: "other-state",
                iss: "https://bsky.social",
            },
            now: NOW,
        })
        expect(result).toEqual({ ok: false, code: "StateInvalid" })
    })

    it("fails with StateInvalid when there is no pending login at all", async () => {
        const result = await completeOAuthLogin({
            pending: null,
            query: { code: "c", state: "s", iss: "https://bsky.social" },
            now: NOW,
        })
        expect(result).toEqual({ ok: false, code: "StateInvalid" })
    })

    it("fails with IssuerMismatch when the callback comes from another issuer", async () => {
        const result = await completeOAuthLogin({
            pending: await pendingFor(),
            query: {
                code: "c",
                state: "state-fixture",
                iss: "https://evil.test",
            },
            now: NOW,
        })
        expect(result).toEqual({ ok: false, code: "IssuerMismatch" })
    })

    it("fails with TokenFailed when the token endpoint rejects the code", async () => {
        const fetchImpl = vi.fn(async () =>
            json(400, { error: "invalid_grant" }),
        )
        const result = await completeOAuthLogin(
            {
                pending: await pendingFor(),
                query: {
                    code: "c",
                    state: "state-fixture",
                    iss: "https://bsky.social",
                },
                now: NOW,
            },
            fetchImpl as unknown as typeof fetch,
        )
        expect(result).toEqual({ ok: false, code: "TokenFailed" })
    })

    it("fails with NotConfigured for a confidential client when the client key is missing, without calling the token endpoint", async () => {
        const fetchImpl = vi.fn(async () => json(200, {}))
        const result = await completeOAuthLogin(
            {
                pending: await pendingFor(
                    "https://skyshare.test/client-metadata.json",
                ),
                query: {
                    code: "c",
                    state: "state-fixture",
                    iss: "https://bsky.social",
                },
                now: NOW,
            },
            fetchImpl as unknown as typeof fetch,
        )
        expect(result).toEqual({ ok: false, code: "NotConfigured" })
        expect(fetchImpl).not.toHaveBeenCalled()
    })

    it("fails with AccountUnverified when the account's PDS cannot be resolved, so no session is created", async () => {
        // トークンは成功するが、持ち主の DID を PLC で解決できない（偽の PLC は未定義の DID に 404 を返す）
        const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
            if (String(input) === TOKEN_ENDPOINT) {
                return json(200, {
                    token_type: "DPoP",
                    access_token: "a",
                    refresh_token: "r",
                    sub: TEST_DID,
                    expires_in: 3600,
                })
            }
            return json(404, {})
        })
        const result = await completeOAuthLogin(
            {
                pending: await pendingFor(),
                query: {
                    code: "c",
                    state: "state-fixture",
                    iss: "https://bsky.social",
                },
                now: NOW,
            },
            fetchImpl as unknown as typeof fetch,
        )
        expect(result).toEqual({ ok: false, code: "AccountUnverified" })
    })
})

describe("startOAuthLogin", () => {
    it("fails with 500 for a confidential client when the client key is missing", async () => {
        const result = await startOAuthLogin(
            { origin: "https://skyshare.test", now: NOW },
            vi.fn() as unknown as typeof fetch,
        )
        expect(result).toEqual({ ok: false, status: 500 })
    })

    it("fails with 502 when the authorization server cannot be read", async () => {
        const fetchImpl = vi.fn(async () => {
            throw new TypeError("network down")
        })
        const result = await startOAuthLogin(
            { origin: "http://localhost:8080", now: NOW },
            fetchImpl as unknown as typeof fetch,
        )
        expect(result).toEqual({ ok: false, status: 502 })
    })
})

/** URL の接頭辞で応答を振り分ける偽の fetch。どれにも合わない要求は 404 */
const routedFetch = (
    routes: Record<
        string,
        (init?: RequestInit) => Response | Promise<Response>
    >,
) =>
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input)
        const key = Object.keys(routes).find(prefix => url.startsWith(prefix))
        return key ? await routes[key](init) : json(404, {})
    })

const AS_METADATA = {
    issuer: "https://bsky.social",
    authorization_endpoint: "https://bsky.social/oauth/authorize",
    token_endpoint: TOKEN_ENDPOINT,
    pushed_authorization_request_endpoint: "https://bsky.social/oauth/par",
    dpop_signing_alg_values_supported: ["ES256"],
    token_endpoint_auth_methods_supported: ["private_key_jwt"],
}

describe("completeOAuthLogin (success)", () => {
    it("creates the session only after the PDS confirms the account and its authorization server matches", async () => {
        const fetchImpl = routedFetch({
            [TOKEN_ENDPOINT]: () =>
                json(200, {
                    token_type: "DPoP",
                    access_token: "a",
                    refresh_token: "r",
                    sub: TEST_DID,
                    expires_in: 3600,
                }),
            "https://plc.directory/": () =>
                json(200, {
                    service: [
                        {
                            id: "#atproto_pds",
                            type: "AtprotoPersonalDataServer",
                            serviceEndpoint: "https://pds.test",
                        },
                    ],
                }),
            "https://pds.test/.well-known/oauth-protected-resource": () =>
                json(200, {
                    resource: "https://pds.test",
                    authorization_servers: ["https://bsky.social"],
                }),
            "https://bsky.social/.well-known/oauth-authorization-server": () =>
                json(200, AS_METADATA),
            "https://pds.test/xrpc/com.atproto.server.getSession": () =>
                json(200, { did: TEST_DID, handle: "alice.test" }),
        })
        const result = await completeOAuthLogin(
            {
                pending: await pendingFor(),
                query: {
                    code: "c",
                    state: "state-fixture",
                    iss: "https://bsky.social",
                },
                now: NOW,
            },
            fetchImpl as unknown as typeof fetch,
        )
        if (!result.ok) throw new Error(`expected success, got ${result.code}`)
        expect(result.session.did).toBe(TEST_DID)
        expect(result.session.handle).toBe("alice.test")
        expect(result.session.oauth.tokenEndpoint).toBe(TOKEN_ENDPOINT)
    })

    it("fails with AccountUnverified when the account's authorization server is a different issuer", async () => {
        const fetchImpl = routedFetch({
            [TOKEN_ENDPOINT]: () =>
                json(200, {
                    token_type: "DPoP",
                    access_token: "a",
                    refresh_token: "r",
                    sub: TEST_DID,
                    expires_in: 3600,
                }),
            "https://plc.directory/": () =>
                json(200, {
                    service: [
                        {
                            id: "#atproto_pds",
                            type: "AtprotoPersonalDataServer",
                            serviceEndpoint: "https://pds.test",
                        },
                    ],
                }),
            "https://pds.test/.well-known/oauth-protected-resource": () =>
                json(200, {
                    resource: "https://pds.test",
                    authorization_servers: ["https://evil.test"],
                }),
            "https://evil.test/.well-known/oauth-authorization-server": () =>
                json(200, { ...AS_METADATA, issuer: "https://evil.test" }),
        })
        const result = await completeOAuthLogin(
            {
                pending: await pendingFor(),
                query: {
                    code: "c",
                    state: "state-fixture",
                    iss: "https://bsky.social",
                },
                now: NOW,
            },
            fetchImpl as unknown as typeof fetch,
        )
        expect(result).toEqual({ ok: false, code: "AccountUnverified" })
    })
})

describe("startOAuthLogin (success)", () => {
    it("returns the authorization URL with the pushed request URI and keeps the pending state", async () => {
        const fetchImpl = routedFetch({
            "https://bsky.social/.well-known/oauth-authorization-server": () =>
                json(200, AS_METADATA),
            "https://bsky.social/oauth/par": () =>
                json(201, {
                    request_uri: "urn:ietf:params:oauth:request_uri:fixture",
                    expires_in: 300,
                }),
        })
        const result = await startOAuthLogin(
            { origin: "http://localhost:8080", now: NOW },
            fetchImpl as unknown as typeof fetch,
        )
        if (!result.ok) throw new Error("expected success")
        expect(result.url).toContain("https://bsky.social/oauth/authorize")
        expect(result.url).toContain(
            "request_uri=urn%3Aietf%3Aparams%3Aoauth%3Arequest_uri%3Afixture",
        )
        expect(result.pending.state.length).toBeGreaterThan(0)
        expect(result.pending.issuer).toBe("https://bsky.social")
    })
})

describe("completeOAuthLogin (PDS session confirmation)", () => {
    /** 持ち主の確認までは成功する経路。getSession の応答だけを差し替える */
    const withSessionReply = (getSession: () => Response | Promise<Response>) =>
        routedFetch({
            [TOKEN_ENDPOINT]: () =>
                json(200, {
                    token_type: "DPoP",
                    access_token: "a",
                    refresh_token: "r",
                    sub: TEST_DID,
                    expires_in: 3600,
                }),
            "https://plc.directory/": () =>
                json(200, {
                    service: [
                        {
                            id: "#atproto_pds",
                            type: "AtprotoPersonalDataServer",
                            serviceEndpoint: "https://pds.test",
                        },
                    ],
                }),
            "https://pds.test/.well-known/oauth-protected-resource": () =>
                json(200, {
                    resource: "https://pds.test",
                    authorization_servers: ["https://bsky.social"],
                }),
            "https://bsky.social/.well-known/oauth-authorization-server": () =>
                json(200, AS_METADATA),
            "https://pds.test/xrpc/com.atproto.server.getSession": getSession,
        })

    const complete = async (fetchImpl: ReturnType<typeof routedFetch>) =>
        completeOAuthLogin(
            {
                pending: await pendingFor(),
                query: {
                    code: "c",
                    state: "state-fixture",
                    iss: "https://bsky.social",
                },
                now: NOW,
            },
            fetchImpl as unknown as typeof fetch,
        )

    it("fails with AccountUnverified when the PDS session belongs to another account", async () => {
        const result = await complete(
            withSessionReply(() =>
                json(200, {
                    did: "did:plc:testfixturebob00000000000000",
                    handle: "bob.test",
                }),
            ),
        )
        expect(result).toEqual({ ok: false, code: "AccountUnverified" })
    })

    it("fails with AccountUnverified when the PDS rejects the session check", async () => {
        const result = await complete(withSessionReply(() => json(401, {})))
        expect(result).toEqual({ ok: false, code: "AccountUnverified" })
    })

    it("fails with AccountUnverified when the session check returns no handle", async () => {
        const result = await complete(
            withSessionReply(() => json(200, { did: TEST_DID })),
        )
        expect(result).toEqual({ ok: false, code: "AccountUnverified" })
    })

    it("fails with AccountUnverified when the PDS cannot be reached for the session check", async () => {
        const result = await complete(
            withSessionReply(() => {
                throw new TypeError("network down")
            }),
        )
        expect(result).toEqual({ ok: false, code: "AccountUnverified" })
    })
})

describe("startOAuthLogin (login hint)", () => {
    it("sends the login hint in the pushed authorization request when one is given", async () => {
        let parBody = ""
        const fetchImpl = routedFetch({
            "https://bsky.social/.well-known/oauth-authorization-server": () =>
                json(200, AS_METADATA),
            "https://bsky.social/oauth/par": init => {
                parBody = String(init?.body ?? "")
                return json(201, {
                    request_uri: "urn:ietf:params:oauth:request_uri:hint",
                    expires_in: 300,
                })
            },
        })
        const result = await startOAuthLogin(
            {
                origin: "http://localhost:8080",
                loginHint: "alice.test",
                now: NOW,
            },
            fetchImpl as unknown as typeof fetch,
        )
        if (!result.ok) throw new Error("expected success")
        expect(new URLSearchParams(parBody).get("login_hint")).toBe(
            "alice.test",
        )
    })
})

describe("pending login cookie", () => {
    it("reads back the pending login it wrote", async () => {
        const { pendingCookie, readPendingCookie } =
            await import("@/lib/session/oauthLogin")
        const pending = await pendingFor()
        const setCookie = pendingCookie(pending)
        const pair = setCookie.slice(0, setCookie.indexOf(";"))
        expect(readPendingCookie(pair)).toMatchObject({
            state: "state-fixture",
            issuer: "https://bsky.social",
        })
    })

    it("ignores a pending cookie that is not a valid pending login (returns null, never a partial state)", async () => {
        const { readPendingCookie } = await import("@/lib/session/oauthLogin")
        const partial = encodeURIComponent(
            btoa(JSON.stringify({ state: "only-state" })),
        )
        expect(readPendingCookie(`oauth_login_pending=${partial}`)).toBeNull()
        expect(readPendingCookie("oauth_login_pending=%%%")).toBeNull()
    })

    it("clears the pending cookie immediately (Max-Age=0), so a state cannot be replayed", async () => {
        const { clearPendingCookie } = await import("@/lib/session/oauthLogin")
        expect(clearPendingCookie()).toContain("Max-Age=0")
    })
})
