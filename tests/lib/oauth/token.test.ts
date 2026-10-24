import { afterEach, beforeEach, describe, expect, test, vi } from "vitest"
import {
    AUTH,
    NONCE,
    createFakeOAuth,
    decodeJwt,
} from "../../helpers/fakeOAuth"
import { createTestClientSecret } from "../../helpers/oauthTestKeys"
import { clientIdFor, loadClientKey } from "@/lib/oauth/client"
import { type AuthorizationServer } from "@/lib/oauth/discovery"
import { createDpopSession } from "@/lib/oauth/dpop"
import { generateEcJwk } from "@/lib/oauth/jose"
import {
    pushAuthorizationRequest,
    requestTokens,
    revokeToken,
} from "@/lib/oauth/token"

const DID = "did:plc:aaaa"
const ORIGIN = "https://skyshare.test"
const NOW = 1_800_000_000
const AS: AuthorizationServer = {
    issuer: AUTH,
    authorizationEndpoint: `${AUTH}/oauth/authorize`,
    parEndpoint: `${AUTH}/oauth/par`,
    tokenEndpoint: `${AUTH}/oauth/token`,
    revocationEndpoint: `${AUTH}/oauth/revoke`,
}

let world: ReturnType<typeof createFakeOAuth>
beforeEach(() => {
    world = createFakeOAuth(DID)
})
afterEach(() => {
    vi.restoreAllMocks()
})

const tokens = async (
    grant: Parameters<typeof requestTokens>[0]["grant"],
    fetchImpl: typeof fetch = world.fetch,
) =>
    requestTokens(
        {
            tokenEndpoint: AS.tokenEndpoint,
            issuer: AS.issuer,
            client: await loadClientKey(await createTestClientSecret()),
            clientId: clientIdFor(ORIGIN),
            grant,
            dpop: await createDpopSession(await generateEcJwk()),
            now: NOW,
        },
        fetchImpl,
    )

/** トークンの端点の応答だけを差し替えた fetch */
const tokenResponse =
    (body: unknown, status = 200): typeof fetch =>
    (async () =>
        new Response(JSON.stringify(body), {
            status,
            headers: { "content-type": "application/json" },
        })) as unknown as typeof fetch

const CODE_GRANT = {
    type: "authorization_code" as const,
    code: "AUTH-CODE-VALUE",
    redirectUri: `${ORIGIN}/oauth/callback/`,
    verifier: "VERIFIER-VALUE",
}

describe("トークンの要求", () => {
    test("oauth-client/AC-8: nonce を求められた要求が、受け取った nonce を入れて1回だけやり直される", async () => {
        const result = await pushAuthorizationRequest(
            {
                as: AS,
                client: await loadClientKey(await createTestClientSecret()),
                clientId: clientIdFor(ORIGIN),
                redirectUri: `${ORIGIN}/oauth/callback/`,
                scope: "atproto transition:generic",
                state: "STATE",
                verifier: "VERIFIER-VALUE",
                dpop: await createDpopSession(await generateEcJwk()),
                now: NOW,
            },
            world.fetch,
        )
        expect(result).toEqual({
            ok: true,
            url: `${AUTH}/oauth/authorize?client_id=${encodeURIComponent(clientIdFor(ORIGIN))}&request_uri=urn%3Arequest%3A1`,
        })
        const pars = world.requests.filter(r => r.url === AS.parEndpoint)
        expect(pars).toHaveLength(2)
        expect(decodeJwt(pars[0]!.dpop!).payload.nonce).toBeUndefined()
        expect(decodeJwt(pars[1]!.dpop!).payload.nonce).toBe(NONCE)
        // ユーザー名の指定が無ければ login_hint を送らない
        expect(pars[1]!.form).not.toHaveProperty("login_hint")
    })

    test("oauth-client/AC-9: 認可コードの交換で、DPoP 型で持ち主と2つのトークンがそろう応答だけがトークンとして返る", async () => {
        expect(await tokens(CODE_GRANT)).toEqual({
            ok: true,
            tokens: {
                accessToken: "ACCESS-TOKEN-VALUE",
                refreshToken: "REFRESH-TOKEN-VALUE",
                expiresAt: NOW + 3600,
                sub: DID,
                scope: "atproto",
            },
        })
        const sent = world.requests.filter(r => r.url === AS.tokenEndpoint).at(-1)!
        expect(sent.form).toMatchObject({
            grant_type: "authorization_code",
            code: "AUTH-CODE-VALUE",
            code_verifier: "VERIFIER-VALUE",
        })

        const base = {
            access_token: "A",
            refresh_token: "R",
            token_type: "DPoP",
            sub: DID,
        }
        expect(
            await tokens(CODE_GRANT, tokenResponse({ ...base, token_type: "Bearer" })),
        ).toEqual({ ok: false, kind: "Invalid" })
        const { refresh_token: _r, ...noRefresh } = base
        expect(await tokens(CODE_GRANT, tokenResponse(noRefresh))).toEqual({
            ok: false,
            kind: "Invalid",
        })
        const { sub: _s, ...noSub } = base
        expect(await tokens(CODE_GRANT, tokenResponse(noSub))).toEqual({
            ok: false,
            kind: "Invalid",
        })
    })

    test("oauth-client/AC-10: 更新用トークンの失効が、再度の許可が必要な失敗として返る", async () => {
        const grant = { type: "refresh_token" as const, refreshToken: "OLD" }
        expect(
            await tokens(grant, tokenResponse({ error: "invalid_grant" }, 400)),
        ).toEqual({ ok: false, kind: "Expired" })
        expect(await tokens(grant, tokenResponse({}, 429))).toEqual({
            ok: false,
            kind: "RateLimited",
        })
        expect(await tokens(grant, tokenResponse({}, 503))).toEqual({
            ok: false,
            kind: "Transient",
        })
        // 秘密鍵が無ければ送らない
        const sent = vi.fn(world.fetch)
        expect(
            await requestTokens(
                {
                    tokenEndpoint: AS.tokenEndpoint,
                    issuer: AS.issuer,
                    client: null,
                    clientId: clientIdFor(ORIGIN),
                    grant,
                    dpop: await createDpopSession(await generateEcJwk()),
                    now: NOW,
                },
                sent as unknown as typeof fetch,
            ),
        ).toEqual({ ok: false, kind: "NotConfigured" })
        expect(sent).not.toHaveBeenCalled()
    })

    test("oauth-client/AC-16: 認可とトークンの要求に失敗しても、トークン・認可コード・鍵がログに現れない", async () => {
        const logs: string[] = []
        for (const level of ["log", "warn", "error"] as const) {
            vi.spyOn(console, level).mockImplementation((...args) => {
                logs.push(args.map(a => String(a)).join(" "))
            })
        }
        const secret = await createTestClientSecret()
        const jwk = await generateEcJwk()
        await tokens(CODE_GRANT, tokenResponse({ error: "invalid_grant" }, 400))
        await tokens(CODE_GRANT, tokenResponse({}, 500))
        await tokens(CODE_GRANT, (async () => {
            throw new TypeError("network AUTH-CODE-VALUE")
        }) as unknown as typeof fetch)
        await pushAuthorizationRequest(
            {
                as: AS,
                client: await loadClientKey(secret),
                clientId: clientIdFor(ORIGIN),
                redirectUri: `${ORIGIN}/oauth/callback/`,
                scope: "atproto",
                state: "STATE",
                verifier: "VERIFIER-VALUE",
                dpop: await createDpopSession(jwk),
                now: NOW,
            },
            tokenResponse({ error: "invalid_request" }, 400),
        )
        await revokeToken(
            {
                revocationEndpoint: AS.revocationEndpoint,
                issuer: AS.issuer,
                client: await loadClientKey(secret),
                clientId: clientIdFor(ORIGIN),
                refreshToken: "REFRESH-TOKEN-VALUE",
                dpop: await createDpopSession(jwk),
                now: NOW,
            },
            (async () => {
                throw new TypeError("REFRESH-TOKEN-VALUE")
            }) as unknown as typeof fetch,
        )
        expect(logs.length).toBeGreaterThan(0)
        const joined = logs.join("\n")
        for (const secretValue of [
            "AUTH-CODE-VALUE",
            "VERIFIER-VALUE",
            "REFRESH-TOKEN-VALUE",
            JSON.parse(secret).d,
            jwk.d,
        ]) {
            expect(joined).not.toContain(secretValue)
        }
    })
})
