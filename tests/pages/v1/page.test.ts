/**
 * `src/pages/v1/page.ts`（DELETE /v1/page）の分岐網羅レベルのテスト。
 *
 * 旧バックエンドへの依頼は `@/lib/legacy/pagedb` の境界でモックし、
 * ルート自身の責務（認証・入力の検証・ステータスへの変換）だけを検証する。
 */
import { afterEach, describe, expect, it, vi } from "vitest"
import type { APIContext } from "astro"

vi.mock("@/lib/legacy/pagedb", () => ({
    deletePageDbEntry: vi.fn(),
}))

import { DELETE } from "@/pages/v1/page"
import { deletePageDbEntry } from "@/lib/legacy/pagedb"
import { encodeBase64Utf8, SESSION_COOKIE_NAME } from "@/lib/session/cookies"

const mockedDelete = vi.mocked(deletePageDbEntry)

afterEach(() => {
    mockedDelete.mockReset()
})

const sessionCookie = `${SESSION_COOKIE_NAME}=${encodeBase64Utf8(
    JSON.stringify({
        session: {
            did: "did:plc:owner",
            handle: "owner.test",
            accessJwt: "jwt",
        },
        service: "https://bsky.social",
    }),
)}`

const call = (body: unknown, cookie: string | null = sessionCookie) =>
    DELETE({
        request: new Request("https://skyshare.nekono.dev/v1/page", {
            method: "DELETE",
            headers: cookie ? { cookie } : {},
            body: typeof body === "string" ? body : JSON.stringify(body),
        }),
    } as unknown as APIContext)

const validBody = { dbIndex: "3", dbKey: "did:plc:owner@3abc" }

describe("DELETE /v1/page", () => {
    it("[legacy-page/AC-1] 本人の資格情報とともに旧バックエンドへ削除を依頼し、200を返す", async () => {
        mockedDelete.mockResolvedValue({ ok: true })
        const res = await call(validBody)
        expect(res.status).toBe(200)
        expect(mockedDelete).toHaveBeenCalledWith({
            dbIndex: "3",
            dbKey: "did:plc:owner@3abc",
            did: "did:plc:owner",
            accessJwt: "jwt",
        })
    })

    it("[legacy-page/AC-2] legacy の識別子でも依頼される", async () => {
        mockedDelete.mockResolvedValue({ ok: true })
        const res = await call({
            dbIndex: "legacy",
            dbKey: "owner.test@3abc",
        })
        expect(res.status).toBe(200)
        expect(mockedDelete).toHaveBeenCalledWith(
            expect.objectContaining({
                dbIndex: "legacy",
                dbKey: "owner.test@3abc",
            }),
        )
    })

    it("[legacy-page/AC-3] 識別子の種類が不正のとき、400を返し依頼しない", async () => {
        const res = await call({ dbIndex: "abc", dbKey: "x@y" })
        expect(res.status).toBe(400)
        expect(mockedDelete).not.toHaveBeenCalled()
    })

    it("[legacy-page/AC-4] 対象のキーの形式が不正のとき、400を返し依頼しない", async () => {
        const res = await call({ dbIndex: "3", dbKey: "no-at-sign" })
        expect(res.status).toBe(400)
        expect(mockedDelete).not.toHaveBeenCalled()
    })

    it("[legacy-page/AC-5] 本文がJSONでないとき、400を返す", async () => {
        const res = await call("not json")
        expect(res.status).toBe(400)
        expect(mockedDelete).not.toHaveBeenCalled()
    })

    it("[legacy-page/AC-6] cookieが無いとき、401を返す", async () => {
        const res = await call(validBody, null)
        expect(res.status).toBe(401)
        expect(mockedDelete).not.toHaveBeenCalled()
    })

    it("[legacy-page/AC-7] cookieはあるがセッションが無いとき、401を返す", async () => {
        const res = await call(validBody, "other=1")
        expect(res.status).toBe(401)
        expect(mockedDelete).not.toHaveBeenCalled()
    })

    it("[legacy-page/AC-8] 旧バックエンドの失敗を、不正な依頼は400、頻度制限は429、それ以外は500に変換する", async () => {
        mockedDelete.mockResolvedValueOnce({ error: "BadRequest" })
        expect((await call(validBody)).status).toBe(400)
        mockedDelete.mockResolvedValueOnce({ error: "RateLimitExceeded" })
        expect((await call(validBody)).status).toBe(429)
        mockedDelete.mockResolvedValueOnce({ error: "InternalServerError" })
        expect((await call(validBody)).status).toBe(500)
    })

    it("[legacy-page/AC-17] OAuth のセッションでの削除の依頼は、旧バックエンドへ送られず、識別子つきの403が返る", async () => {
        const oauthCookie = `${SESSION_COOKIE_NAME}=${encodeBase64Utf8(
            JSON.stringify({
                kind: "oauth",
                did: "did:plc:owner",
                handle: "owner.test",
                pds: "https://pds.example",
                oauth: {
                    accessToken: "ACCESS",
                    expiresAt: 1_800_000_000,
                    refreshToken: "REFRESH",
                    dpopJwk: { kty: "EC", crv: "P-256", x: "x", y: "y", d: "d" },
                    issuer: "https://bsky.social",
                    tokenEndpoint: "https://bsky.social/oauth/token",
                    clientId: "https://skyshare.test/oauth/client-metadata.json",
                },
            }),
        )}`
        const res = await call(validBody, oauthCookie)
        expect(res.status).toBe(403)
        expect(await res.json()).toEqual({ error: "OAuthSessionUnsupported" })
        expect(mockedDelete).not.toHaveBeenCalled()
    })
})
