import { afterEach, beforeEach, describe, expect, test, vi } from "vitest"
import type { APIContext } from "astro"
import {
    PDS,
    PDS_NONCE,
    createFakeOAuth,
    decodeJwt,
} from "../../helpers/fakeOAuth"
import { createTestClientSecret } from "../../helpers/oauthTestKeys"

const holder = vi.hoisted(() => ({ secret: undefined as string | undefined }))
vi.mock("@/lib/oauth/env", () => ({
    getOAuthClientSecret: async () => holder.secret,
}))

import { generateEcJwk } from "@/lib/oauth/jose"
import { refreshBskySession } from "@/lib/session/bskySessionRefresh"
import {
    makeAccountsSetCookies,
    makeSessionSetCookie,
    parseSessionFromRequest,
    type OAuthSession,
} from "@/lib/session/cookies"
import {
    ensureFreshOAuthSession,
    nonceCookie,
} from "@/lib/session/oauthSession"
import { PUT } from "@/pages/v2/bsky/session"
import { DELETE } from "@/pages/v2/bsky/session/[did]"

const DID = "did:plc:aaaa"
const BSKY = "https://bsky.social"
const ORIGIN = "https://skyshare.test"

let world: ReturnType<typeof createFakeOAuth>
beforeEach(async () => {
    world = createFakeOAuth(DID, { auth: BSKY })
    vi.stubGlobal("fetch", world.fetch)
    holder.secret = await createTestClientSecret()
})
afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
})

const nowSec = () => Math.floor(Date.now() / 1000)

/** テスト用の OAuth のセッション。`expiresIn` はアクセストークンの期限までの秒数 */
const oauthSession = async (expiresIn: number): Promise<OAuthSession> => ({
    kind: "oauth",
    did: DID,
    handle: "alice.test",
    pds: PDS,
    oauth: {
        accessToken: "OLD-ACCESS",
        expiresAt: nowSec() + expiresIn,
        refreshToken: "OLD-REFRESH",
        dpopJwk: await generateEcJwk(),
        issuer: BSKY,
        tokenEndpoint: `${BSKY}/oauth/token`,
        revocationEndpoint: `${BSKY}/oauth/revoke`,
        clientId: `${ORIGIN}/oauth/client-metadata.json`,
    },
})

const cookieOf = (setCookie: string) => setCookie.split(";")[0]!

/** ミドルウェアを通して、ハンドラで PDS のセッションを1回取得する */
const callApi = async (cookie: string) => {
    const context = {
        url: new URL(`${ORIGIN}/v2/entry`),
        request: new Request(`${ORIGIN}/v2/entry`, { headers: { cookie } }),
        locals: {} as App.Locals,
    } as unknown as APIContext
    const res = await refreshBskySession(context, async () => {
        const agent = context.locals.agent!
        const session = await agent.com.atproto.server.getSession()
        return new Response(JSON.stringify(session.data), { status: 200 })
    })
    return { res: res as Response, locals: context.locals }
}

/** 認可サーバーが受け付けたトークンの要求（nonce を求めて断った最初の要求を除く） */
const tokenRequests = () =>
    world.requests.filter(
        r =>
            r.url === `${BSKY}/oauth/token` &&
            r.dpop !== undefined &&
            decodeJwt(r.dpop).payload.nonce !== undefined,
    )

describe("OAuth のセッションの再開", () => {
    test("oauth-session/AC-9: 期限まで余裕のあるセッションは更新も書き戻しもされず、期限の近いセッションは更新されて書き戻される", async () => {
        const fresh = await oauthSession(600)
        const first = await callApi(cookieOf(makeSessionSetCookie(fresh)))
        expect(first.res.status).toBe(200)
        expect(first.locals.session).toEqual({ did: DID, handle: "alice.test" })
        expect(first.locals.service).toBe(PDS)
        expect(tokenRequests()).toHaveLength(0)
        expect(
            first.res.headers
                .getSetCookie()
                .some(c => c.startsWith("atp_session=")),
        ).toBe(false)

        const expiring = await oauthSession(30)
        const second = await callApi(cookieOf(makeSessionSetCookie(expiring)))
        expect(second.res.status).toBe(200)
        expect(tokenRequests().at(-1)!.form).toMatchObject({
            grant_type: "refresh_token",
            refresh_token: "OLD-REFRESH",
        })
        const written = second.res.headers
            .getSetCookie()
            .find(c => c.startsWith("atp_session="))!
        const next = parseSessionFromRequest(
            new Request(ORIGIN, { headers: { cookie: cookieOf(written) } }),
        ) as OAuthSession
        expect(next.oauth).toMatchObject({
            accessToken: "ACCESS-TOKEN-VALUE",
            refreshToken: "REFRESH-TOKEN-VALUE",
        })
        expect(next.oauth.expiresAt).toBeGreaterThan(nowSec() + 3000)
        // PDS への要求は新しいアクセストークンで送る
        expect(world.pdsRequests.at(-1)!.authorization).toBe(
            "DPoP ACCESS-TOKEN-VALUE",
        )
    })

    test("oauth-session/AC-10: 更新用トークンが失効しているとき、v2 の API が401で拒否される", async () => {
        world.tokenError = { status: 400, error: "invalid_grant" }
        const next = vi.fn()
        const context = {
            url: new URL(`${ORIGIN}/v2/entry`),
            request: new Request(`${ORIGIN}/v2/entry`, {
                headers: {
                    cookie: cookieOf(makeSessionSetCookie(await oauthSession(0))),
                },
            }),
            locals: {},
        } as unknown as APIContext
        const res = (await refreshBskySession(context, next)) as Response
        expect(res.status).toBe(401)
        expect(next).not.toHaveBeenCalled()
        // 一時的な失敗は 401 にしない（再ログインを求めない）
        world.tokenError = { status: 503, error: "unavailable" }
        expect(
            await ensureFreshOAuthSession(await oauthSession(0), nowSec()),
        ).toEqual({ ok: false, status: 502 })
    })

    test("oauth-session/AC-11: PDS への要求に DPoP の証明が付き、受け取った nonce が cookie に書かれて次のリクエストの証明に入る", async () => {
        const session = cookieOf(makeSessionSetCookie(await oauthSession(600)))
        const first = await callApi(session)
        expect(world.pdsRequests).toHaveLength(2)
        const proof = decodeJwt(world.pdsRequests[1]!.dpop!).payload
        expect(proof).toMatchObject({ htm: "GET", nonce: PDS_NONCE })
        expect(proof.ath).toBeTypeOf("string")
        const carried = first.res.headers
            .getSetCookie()
            .find(c => c.startsWith("atp_dpop_nonce="))!
        expect(carried).toBe(nonceCookie(new URL(PDS).origin, PDS_NONCE))
        expect(carried).toContain("HttpOnly")

        // 次のリクエストは最初の要求から nonce を入れ、やり直さない。nonce が同じなら書き戻さない
        world.pdsRequests.length = 0
        const second = await callApi(`${session}; ${cookieOf(carried)}`)
        expect(world.pdsRequests).toHaveLength(1)
        expect(decodeJwt(world.pdsRequests[0]!.dpop!).payload.nonce).toBe(
            PDS_NONCE,
        )
        expect(
            second.res.headers
                .getSetCookie()
                .some(c => c.startsWith("atp_dpop_nonce=")),
        ).toBe(false)
    })
})

describe("OAuth のアカウントの切り替えとログアウト", () => {
    const pooledCookie = async (expiresIn: number) =>
        cookieOf(
            makeAccountsSetCookies([
                {
                    ...(await oauthSession(expiresIn)),
                    addedAt: "2026-01-01T00:00:00.000Z",
                },
            ])[0]!,
        )

    const callPut = async (cookie: string) =>
        (await PUT({
            request: new Request(`${ORIGIN}/v2/bsky/session/`, {
                method: "PUT",
                headers: { cookie },
                body: JSON.stringify({ did: DID }),
            }),
        } as unknown as APIContext)) as Response

    test("oauth-session/AC-12: 期限の近い OAuth のアカウントへの切り替えで更新が行われ、失効していれば401になる", async () => {
        const res = await callPut(await pooledCookie(10))
        expect(res.status).toBe(200)
        expect(tokenRequests()).toHaveLength(1)
        const active = parseSessionFromRequest(
            new Request(ORIGIN, {
                headers: {
                    cookie: cookieOf(
                        res.headers
                            .getSetCookie()
                            .find(c => c.startsWith("atp_session="))!,
                    ),
                },
            }),
        ) as OAuthSession
        expect(active).toMatchObject({ kind: "oauth", did: DID })
        expect(active).not.toHaveProperty("addedAt")
        expect(active.oauth.refreshToken).toBe("REFRESH-TOKEN-VALUE")

        // 期限まで余裕があれば更新しない
        expect((await callPut(await pooledCookie(600))).status).toBe(200)
        expect(tokenRequests()).toHaveLength(1)

        world.tokenError = { status: 400, error: "invalid_grant" }
        expect((await callPut(await pooledCookie(10))).status).toBe(401)
    })

    test("oauth-session/AC-13: OAuth のアカウントのログアウトで取消が依頼され、取消が失敗しても cookie から除かれる", async () => {
        const callDelete = async (cookie: string) =>
            (await DELETE({
                request: new Request(`${ORIGIN}/v2/bsky/session/${DID}/`, {
                    method: "DELETE",
                    headers: { cookie },
                }),
                params: { did: DID },
            } as unknown as APIContext)) as Response

        const active = cookieOf(makeSessionSetCookie(await oauthSession(600)))
        const res = await callDelete(active)
        expect(res.status).toBe(200)
        const revoke = world.requests.filter(r => r.url === `${BSKY}/oauth/revoke`)
        expect(revoke.at(-1)!.form).toMatchObject({
            token: "OLD-REFRESH",
            token_type_hint: "refresh_token",
        })
        expect(
            res.headers
                .getSetCookie()
                .find(c => c.startsWith("atp_session="))!,
        ).toContain("Max-Age=0")

        // 取消の通信が失敗しても、プールから除く
        vi.spyOn(console, "warn").mockImplementation(() => {})
        vi.stubGlobal("fetch", async () => {
            throw new TypeError("offline")
        })
        const pooledRes = await callDelete(await pooledCookie(600))
        expect(pooledRes.status).toBe(200)
        expect(
            pooledRes.headers
                .getSetCookie()
                .find(c => c.startsWith("atp_account_0="))!,
        ).toContain("Max-Age=0")
    })
})
