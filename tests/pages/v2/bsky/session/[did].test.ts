/**
 * `src/pages/v2/bsky/session/[did].ts`(DELETE /v2/bsky/session/{did})の
 * 分岐網羅レベルのテスト。AtpAgentを一切使わないルートのため、Cookieヘッダの
 * 組み立てのみで全分岐を駆動する。
 */
import { describe, expect, it } from "vitest"
import type { APIContext } from "astro"

import { DELETE } from "@/pages/v2/bsky/session/[did]"
import {
    encodeBase64Utf8,
    SESSION_COOKIE_NAME,
    ACCOUNTS_COOKIE_NAME,
} from "@/lib/session/cookies.js"

const callRoute = (request: Request, did: string | undefined) =>
    DELETE({ request, params: { did } } as unknown as APIContext)

const activeDid = "did:plc:active"
const pooledDid = "did:plc:pooled"

const sessionCookieValue = encodeBase64Utf8(
    JSON.stringify({
        session: { did: activeDid, handle: "active.bsky.social" },
        service: "https://bsky.social",
    }),
)
const accountsCookieValue = encodeBase64Utf8(
    JSON.stringify([
        {
            did: pooledDid,
            handle: "pooled.bsky.social",
            service: "https://bsky.social",
            session: {},
            addedAt: "2024-01-01T00:00:00.000Z",
        },
    ]),
)

describe("DELETE /v2/bsky/session/{did}", () => {
    it("didが未指定の場合は400を返す", async () => {
        const request = new Request(
            "https://skyshare.nekono.dev/v2/bsky/session/",
        )
        const res = await callRoute(request, undefined)
        expect(res.status).toBe(400)
    })

    it("アクティブ・プールいずれにも見つからない場合は404を返す", async () => {
        const request = new Request(
            "https://skyshare.nekono.dev/v2/bsky/session/did:plc:unknown",
            {
                headers: {
                    cookie: `${SESSION_COOKIE_NAME}=${sessionCookieValue}`,
                },
            },
        )
        const res = await callRoute(request, "did:plc:unknown")
        expect(res.status).toBe(404)
    })

    it("アクティブアカウント対象の場合はatp_sessionを失効させる", async () => {
        const request = new Request(
            `https://skyshare.nekono.dev/v2/bsky/session/${activeDid}`,
            {
                headers: {
                    cookie: `${SESSION_COOKIE_NAME}=${sessionCookieValue}`,
                },
            },
        )
        const res = await callRoute(request, activeDid)
        expect(res.status).toBe(200)
        const setCookies = res.headers.getSetCookie
            ? res.headers.getSetCookie()
            : [res.headers.get("set-cookie") ?? ""]
        expect(
            setCookies.some(c => c.startsWith(`${SESSION_COOKIE_NAME}=;`)),
        ).toBe(true)
    })

    it("プール中アカウント対象の場合はatp_accountsから除去する", async () => {
        const request = new Request(
            `https://skyshare.nekono.dev/v2/bsky/session/${pooledDid}`,
            {
                headers: {
                    cookie: `${SESSION_COOKIE_NAME}=${sessionCookieValue}; ${ACCOUNTS_COOKIE_NAME}=${accountsCookieValue}`,
                },
            },
        )
        const res = await callRoute(request, pooledDid)
        expect(res.status).toBe(200)
        const setCookies = res.headers.getSetCookie
            ? res.headers.getSetCookie()
            : [res.headers.get("set-cookie") ?? ""]
        expect(
            setCookies.some(c => c.startsWith(`${ACCOUNTS_COOKIE_NAME}=;`)),
        ).toBe(true)
    })

    it("不正なatp_session cookie値の場合は500を返す", async () => {
        const request = new Request(
            `https://skyshare.nekono.dev/v2/bsky/session/${activeDid}`,
            { headers: { cookie: `${SESSION_COOKIE_NAME}=!!!not-base64!!!` } },
        )
        const res = await callRoute(request, activeDid)
        expect(res.status).toBe(500)
    })
})
