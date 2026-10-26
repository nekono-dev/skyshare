import { afterEach, beforeEach, describe, expect, test, vi } from "vitest"
import type { APIContext } from "astro"
import { createFakeOAuth } from "../../../helpers/fakeOAuth"
import { createTestClientSecret } from "../../../helpers/oauthTestKeys"

const holder = vi.hoisted(() => ({ secret: undefined as string | undefined }))
vi.mock("@/lib/oauth/env", () => ({
    getOAuthClientSecret: async () => holder.secret,
}))

import { POST as start } from "@/pages/v2/bsky/session/authorization"
import { POST as complete } from "@/pages/v2/bsky/session/authorization/completion"
import {
    MAX_POOLED_ACCOUNTS,
    makeAccountsSetCookies,
    makeSessionSetCookie,
    parseAccountsFromRequest,
    parseSessionFromRequest,
    type PasswordSession,
} from "@/lib/session/cookies"
import { SESSION_AUTHORIZATION_SERVER } from "@/lib/session/oauthLogin"

const DID = "did:plc:aaaa"
const ORIGIN = "https://skyshare.test"
const BSKY = SESSION_AUTHORIZATION_SERVER

let world: ReturnType<typeof createFakeOAuth>
let logs: string[]
beforeEach(async () => {
    world = createFakeOAuth(DID, { auth: BSKY })
    vi.stubGlobal("fetch", world.fetch)
    holder.secret = await createTestClientSecret()
    logs = []
    for (const level of ["log", "warn", "error"] as const) {
        vi.spyOn(console, level).mockImplementation((...args) => {
            logs.push(args.map(a => String(a)).join(" "))
        })
    }
})
afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
})

const callStart = (body = "", cookie = "") =>
    (start as (c: APIContext) => Promise<Response>)({
        request: new Request(`${ORIGIN}/v2/bsky/session/authorization/`, {
            method: "POST",
            body,
            headers: cookie ? { cookie } : {},
        }),
    } as unknown as APIContext)

const callComplete = (body: object | string, cookie = "") =>
    (complete as (c: APIContext) => Promise<Response>)({
        request: new Request(
            `${ORIGIN}/v2/bsky/session/authorization/completion/`,
            {
                method: "POST",
                body: typeof body === "string" ? body : JSON.stringify(body),
                headers: cookie ? { cookie } : {},
            },
        ),
    } as unknown as APIContext)

/** `Set-Cookie` の一覧を、要求の `Cookie` ヘッダーにまとめる（失効は除く） */
const toCookieHeader = (setCookies: string[]) =>
    setCookies
        .filter(c => !c.includes("Max-Age=0"))
        .map(c => c.split(";")[0])
        .join("; ")

const password = (did: string): PasswordSession => ({
    kind: "password",
    session: {
        did,
        handle: `${did}.test`,
        accessJwt: "A",
        refreshJwt: "R",
        active: true,
    },
    service: "https://bsky.social",
})

/** 開始の応答から、途中の状態の cookie と送った state を取り出す */
const begin = async () => {
    const res = await callStart(JSON.stringify({ returnTo: "/accounts/" }))
    expect(res.status).toBe(200)
    const pending = res.headers
        .getSetCookie()
        .find(c => c.startsWith("oauth_login_pending="))!
    const state = world.requests
        .filter(r => r.url === `${BSKY}/oauth/par`)
        .at(-1)!.form.state!
    return { res, pending, state }
}

describe("OAuth のログインの API", () => {
    test("[oauth-session/1.3] 開始の応答に、完了の API のパスに限った HttpOnly で10分の途中の状態の cookie が付く", async () => {
        const { res, pending } = await begin()
        expect(pending).toContain("Path=/v2/bsky/session/authorization/")
        expect(pending).toContain("Max-Age=600")
        expect(pending).toContain("HttpOnly")
        expect(pending).toContain("SameSite=Strict")
        // 戻り先の cookie に、用途とページが入る
        expect(
            res.headers.getSetCookie().find(c => c.startsWith("oauth_return=")),
        ).toContain(encodeURIComponent("session:/accounts/"))
        expect((await res.json()).url).toMatch(`${BSKY}/oauth/authorize?`)
    })

    test("[oauth-session/2.5] [schedule-api/4.6,4.8,4.10] 照合と確認に成功すると OAuth のセッションがアクティブになり、別のアカウントがアクティブだったときはプールへ退避される", async () => {
        const { pending, state } = await begin()
        const current = makeSessionSetCookie(password("did:plc:current"))
        const res = await callComplete(
            { code: "AUTH-CODE-VALUE", state, iss: BSKY },
            toCookieHeader([pending, current]),
        )
        expect(res.status).toBe(200)
        expect(await res.json()).toEqual({ result: "ok" })
        // アクティブなアカウントが変わるため、予約投稿の登録状態のヒントを失効させる
        expect(
            res.headers
                .getSetCookie()
                .some(c => c.startsWith("skyshare_schedule=;")),
        ).toBe(true)

        const next = new Request(ORIGIN, {
            headers: { cookie: toCookieHeader(res.headers.getSetCookie()) },
        })
        expect(parseSessionFromRequest(next)).toMatchObject({
            kind: "oauth",
            did: DID,
        })
        expect(parseAccountsFromRequest(next)).toEqual([
            expect.objectContaining({
                kind: "password",
                session: expect.objectContaining({ did: "did:plc:current" }),
            }),
        ])
    })

    test("[oauth-session/2.6] プールが上限に達しているとき、別のアカウントでの完了が409で拒否される", async () => {
        const { pending, state } = await begin()
        const pool = makeAccountsSetCookies(
            Array.from({ length: MAX_POOLED_ACCOUNTS }, (_, i) => ({
                ...password(`did:plc:p${i}`),
                addedAt: "2026-01-01T00:00:00.000Z",
            })),
        )
        const res = await callComplete(
            { code: "AUTH-CODE-VALUE", state, iss: BSKY },
            toCookieHeader([
                pending,
                makeSessionSetCookie(password("did:plc:current")),
                ...pool,
            ]),
        )
        expect(res.status).toBe(409)
        // 上限で拒否しても、途中の状態は消す
        expect(
            res.headers
                .getSetCookie()
                .some(c => c.startsWith("oauth_login_pending=;")),
        ).toBe(true)
        expect(
            res.headers.getSetCookie().some(c => c.startsWith("atp_session=")),
        ).toBe(false)
    })

    test("[oauth-session/2.7] 拒否の戻りで、途中の状態の cookie が消え、拒否の分類が返る", async () => {
        const { pending, state } = await begin()
        const res = await callComplete(
            { error: "access_denied", state },
            toCookieHeader([pending]),
        )
        expect(res.status).toBe(200)
        expect(await res.json()).toEqual({ result: "Denied" })
        const cleared = res.headers
            .getSetCookie()
            .find(c => c.startsWith("oauth_login_pending="))!
        expect(cleared).toContain("Max-Age=0")
        expect(cleared).toContain("Path=/v2/bsky/session/authorization/")
    })

    test("[oauth-session/2.8] 開始と完了の応答に、キャッシュを禁止する指定が付く", async () => {
        const { res, pending, state } = await begin()
        expect(res.headers.get("cache-control")).toBe("no-store")
        for (const r of [
            await callStart("not json"),
            await callComplete("not json"),
            await callComplete({ code: 1 }),
            await callComplete(
                { code: "AUTH-CODE-VALUE", state, iss: BSKY },
                toCookieHeader([pending]),
            ),
        ]) {
            expect(r.headers.get("cache-control")).toBe("no-store")
        }
    })

    test("[oauth-session/2.9] 完了に失敗しても、トークン・認可コード・鍵がログと応答の本文に現れない", async () => {
        const { pending, state } = await begin()
        world.tokenError = { status: 400, error: "invalid_grant" }
        const failedToken = await callComplete(
            { code: "AUTH-CODE-VALUE", state, iss: BSKY },
            toCookieHeader([pending]),
        )
        expect(await failedToken.json()).toEqual({ result: "TokenFailed" })

        world.tokenError = undefined
        world.sessionDid = null
        const second = await begin()
        const unverified = await callComplete(
            { code: "AUTH-CODE-VALUE", state: second.state, iss: BSKY },
            toCookieHeader([second.pending]),
        )
        const body = JSON.stringify(await unverified.json())
        expect(body).toBe(JSON.stringify({ result: "AccountUnverified" }))

        const joined = [...logs, body].join("\n")
        for (const secret of [
            "AUTH-CODE-VALUE",
            "ACCESS-TOKEN-VALUE",
            "REFRESH-TOKEN-VALUE",
            JSON.parse(holder.secret!).d,
        ]) {
            expect(joined).not.toContain(secret)
        }
        // 途中の状態（DPoP の秘密鍵を含む）もログに出さない
        expect(joined).not.toContain(pending.split(";")[0]!.split("=")[1]!)
    })
})
