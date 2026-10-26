import { beforeEach, describe, expect, test, vi } from "vitest"
import { HANDLE, PDS, createFakeOAuth } from "../../helpers/fakeOAuth"
import { createTestClientSecret } from "../../helpers/oauthTestKeys"

const holder = vi.hoisted(() => ({ secret: undefined as string | undefined }))
vi.mock("@/lib/oauth/env", () => ({
    getOAuthClientSecret: async () => holder.secret,
}))

import { SESSION_SCOPE, clientIdFor } from "@/lib/oauth/client"
import {
    SESSION_AUTHORIZATION_SERVER,
    completeOAuthLogin,
    startOAuthLogin,
} from "@/lib/session/oauthLogin"

const DID = "did:plc:aaaa"
const ORIGIN = "https://skyshare.test"
const NOW = 1_800_000_000
const BSKY = SESSION_AUTHORIZATION_SERVER

let world: ReturnType<typeof createFakeOAuth>
beforeEach(async () => {
    world = createFakeOAuth(DID, { auth: BSKY })
    holder.secret = await createTestClientSecret()
})

/** ログインを開始し、PAR の要求と途中の状態を返す */
const start = async (loginHint?: string) => {
    const result = await startOAuthLogin(
        { origin: ORIGIN, loginHint, now: NOW },
        world.fetch,
    )
    if (!result.ok) throw new Error(`start failed: ${result.status}`)
    const par = world.requests
        .filter(r => r.url === `${BSKY}/oauth/par`)
        .at(-1)!
    return { ...result, par }
}

const complete = (
    pending: Awaited<ReturnType<typeof start>>["pending"] | null,
    query: object = {},
) =>
    completeOAuthLogin(
        {
            pending,
            query: {
                code: "AUTH-CODE-VALUE",
                state: pending?.state,
                iss: BSKY,
                ...query,
            },
            now: NOW + 30,
        },
        world.fetch,
    )

describe("OAuth のログインの開始と完了", () => {
    test("[oauth-session/1.1] 開始で、ユーザー名を含まずログインの権限を指定した事前の要求が送られ、認可の画面の住所が返る", async () => {
        const { url, par, pending } = await start()
        const to = new URL(url)
        expect(`${to.origin}${to.pathname}`).toBe(`${BSKY}/oauth/authorize`)
        expect(to.searchParams.get("client_id")).toBe(clientIdFor(ORIGIN))
        expect(par.form.scope).toBe(SESSION_SCOPE)
        expect(par.form).not.toHaveProperty("login_hint")
        expect(par.form.state).toBe(pending.state)
        expect(pending).toMatchObject({
            issuer: BSKY,
            tokenEndpoint: `${BSKY}/oauth/token`,
            clientId: clientIdFor(ORIGIN),
            redirectUri: `${ORIGIN}/oauth/callback/`,
        })
    })

    test("[oauth-session/1.2] ハンドルを指定した開始では、そのハンドルが入力済みの指定として送られる", async () => {
        const { par } = await start("alice.bsky.social")
        expect(par.form.login_hint).toBe("alice.bsky.social")
    })

    test("[oauth-session/2.1,2.2] 途中の状態と違う state・途中の状態が無い戻り・発行元の違う戻りでは、トークンを要求しない", async () => {
        const { pending } = await start()
        const tokenRequests = () =>
            world.requests.filter(r => r.url === `${BSKY}/oauth/token`).length
        expect(await complete(pending, { state: "OTHER" })).toEqual({
            ok: false,
            code: "StateInvalid",
        })
        expect(await complete(null)).toEqual({
            ok: false,
            code: "StateInvalid",
        })
        expect(
            await complete(pending, { iss: "https://evil.example" }),
        ).toEqual({ ok: false, code: "IssuerMismatch" })
        expect(await complete(pending, { error: "access_denied" })).toEqual({
            ok: false,
            code: "Denied",
        })
        expect(tokenRequests()).toBe(0)
    })

    test("[oauth-session/2.3,2.4] 持ち主の PDS の認可サーバーが発行元と違うトークンと、PDS がセッションを返さないトークンでは、セッションが作られない", async () => {
        const { pending } = await start()
        // 持ち主の PDS が別の認可サーバーを指す
        const otherAs = createFakeOAuth(DID)
        const mixed = (async (input: string, init?: RequestInit) =>
            new URL(input).href ===
            `${PDS}/.well-known/oauth-protected-resource`
                ? otherAs.fetch(input, init)
                : world.fetch(input, init)) as unknown as typeof fetch
        expect(
            await completeOAuthLogin(
                {
                    pending,
                    query: { code: "C", state: pending.state, iss: BSKY },
                    now: NOW,
                },
                mixed,
            ),
        ).toEqual({ ok: false, code: "AccountUnverified" })

        const second = await start()
        world.sessionDid = null
        expect(await complete(second.pending)).toEqual({
            ok: false,
            code: "AccountUnverified",
        })
    })

    test("照合と確認に成功すると、DPoP の鍵と端点とトークンを持つ OAuth のセッションが返る", async () => {
        const { pending } = await start()
        const result = await complete(pending)
        expect(result).toEqual({
            ok: true,
            session: {
                kind: "oauth",
                did: DID,
                handle: HANDLE,
                pds: PDS,
                oauth: {
                    accessToken: "ACCESS-TOKEN-VALUE",
                    refreshToken: "REFRESH-TOKEN-VALUE",
                    expiresAt: NOW + 30 + 3600,
                    dpopJwk: pending.dpopJwk,
                    issuer: BSKY,
                    tokenEndpoint: `${BSKY}/oauth/token`,
                    revocationEndpoint: `${BSKY}/oauth/revoke`,
                    clientId: clientIdFor(ORIGIN),
                },
            },
        })
        // PDS への確認は DPoP のアクセストークンで送っている
        expect(world.pdsRequests.at(-1)!.authorization).toBe(
            "DPoP ACCESS-TOKEN-VALUE",
        )
    })

    test("開発用の公開クライアントは秘密鍵が無くても開始でき、それ以外は秘密鍵が無ければ500になる", async () => {
        holder.secret = undefined
        expect(
            await startOAuthLogin({ origin: ORIGIN, now: NOW }, world.fetch),
        ).toEqual({ ok: false, status: 500 })
        const dev = await startOAuthLogin(
            { origin: "https://localhost:4321", now: NOW },
            world.fetch,
        )
        expect(dev.ok).toBe(true)
        const par = world.requests
            .filter(r => r.url === `${BSKY}/oauth/par`)
            .at(-1)!
        expect(par.form).not.toHaveProperty("client_assertion")
        expect(par.form.redirect_uri).toBe(
            "http://127.0.0.1:4322/oauth/callback/",
        )
    })
})
