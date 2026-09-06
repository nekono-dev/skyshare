/**
 * `src/pages/v2/bsky/session.ts`(GET/POST/PUT /v2/bsky/session)の
 * 分岐網羅レベルのテスト。
 *
 * このファイルのみ、ルートが `AtpAgent` を自前生成する（`locals.agent` 経由で
 * 受け取らない）ため、`@/lib/atproto/agentFactory` の `createAtpAgent` を
 * `vi.mock` してフェイクエージェントを注入する。他のテストファイルとはモックの
 * 置き方が異なる点に注意（`tests/README.md` 参照）。
 */
import { afterEach, describe, expect, it, vi } from "vitest"
import type { APIContext } from "astro"

import { GET, POST, PUT } from "@/pages/v2/bsky/session"
import {
    encodeBase64Utf8,
    SESSION_COOKIE_NAME,
    ACCOUNTS_COOKIE_NAME,
    MAX_POOLED_ACCOUNTS,
} from "@/lib/session/cookies.js"

vi.mock("@/lib/atproto/agentFactory", () => ({
    createAtpAgent: vi.fn(),
}))

import { createAtpAgent } from "@/lib/atproto/agentFactory"

const mockedCreateAtpAgent = vi.mocked(createAtpAgent)

afterEach(() => {
    mockedCreateAtpAgent.mockReset()
})

const callRoute = (handler: typeof GET, request: Request) =>
    handler({ request } as unknown as APIContext)

const buildSessionCookie = (session: object, service = "https://bsky.social") =>
    `${SESSION_COOKIE_NAME}=${encodeBase64Utf8(
        JSON.stringify({ session, service }),
    )}`

const buildAccountsCookie = (accounts: object[]) =>
    `${ACCOUNTS_COOKIE_NAME}=${encodeBase64Utf8(JSON.stringify(accounts))}`

describe("GET /v2/bsky/session", () => {
    it("cookieヘッダーが無い場合は401を返す", async () => {
        const request = new Request(
            "https://skyshare.nekono.dev/v2/bsky/session/",
        )
        const res = await callRoute(GET, request)
        expect(res.status).toBe(401)
    })

    it("cookieはあるがアクティブ・プール共に無い場合は401を返す", async () => {
        const request = new Request(
            "https://skyshare.nekono.dev/v2/bsky/session/",
            { headers: { cookie: "unrelated=1" } },
        )
        const res = await callRoute(GET, request)
        expect(res.status).toBe(401)
    })

    it("アクティブアカウントのみの場合、そのプロフィールを付与して200を返す", async () => {
        mockedCreateAtpAgent.mockReturnValue({
            getProfile: vi.fn().mockResolvedValue({
                data: { displayName: "Alice", avatar: "https://a" },
            }),
        } as any)
        const request = new Request(
            "https://skyshare.nekono.dev/v2/bsky/session/",
            {
                headers: {
                    cookie: buildSessionCookie({
                        did: "did:plc:active",
                        handle: "active.bsky.social",
                    }),
                },
            },
        )
        const res = await callRoute(GET, request)
        expect(res.status).toBe(200)
        const json = await res.json()
        expect(json.accounts).toHaveLength(1)
        expect(json.accounts[0]).toMatchObject({
            did: "did:plc:active",
            isActive: true,
            displayName: "Alice",
        })
    })

    it("アクティブ+プールがある場合、アクティブを先頭に並べる", async () => {
        mockedCreateAtpAgent.mockReturnValue({
            getProfile: vi.fn().mockResolvedValue({ data: {} }),
        } as any)
        const request = new Request(
            "https://skyshare.nekono.dev/v2/bsky/session/",
            {
                headers: {
                    cookie: [
                        buildSessionCookie({
                            did: "did:plc:active",
                            handle: "active.bsky.social",
                        }),
                        buildAccountsCookie([
                            {
                                did: "did:plc:pooled",
                                handle: "pooled.bsky.social",
                                service: "https://bsky.social",
                                session: {},
                                addedAt: "2024-01-01T00:00:00.000Z",
                            },
                        ]),
                    ].join("; "),
                },
            },
        )
        const res = await callRoute(GET, request)
        expect(res.status).toBe(200)
        const json = await res.json()
        expect(json.accounts.map((a: any) => a.did)).toEqual([
            "did:plc:active",
            "did:plc:pooled",
        ])
        expect(json.accounts[0].isActive).toBe(true)
        expect(json.accounts[1].isActive).toBe(false)
    })

    it("プロフィール取得が失敗しても致命的にならず空メタで返す", async () => {
        mockedCreateAtpAgent.mockReturnValue({
            getProfile: vi.fn().mockRejectedValue(new Error("network error")),
        } as any)
        const request = new Request(
            "https://skyshare.nekono.dev/v2/bsky/session/",
            {
                headers: {
                    cookie: buildSessionCookie({
                        did: "did:plc:active",
                        handle: "active.bsky.social",
                    }),
                },
            },
        )
        const res = await callRoute(GET, request)
        expect(res.status).toBe(200)
        const json = await res.json()
        expect(json.accounts[0].displayName).toBeUndefined()
    })
})

describe("POST /v2/bsky/session", () => {
    it("bodyがスキーマ不正(identifier欠落)の場合は400を返す", async () => {
        const request = new Request(
            "https://skyshare.nekono.dev/v2/bsky/session/",
            {
                method: "POST",
                body: JSON.stringify({
                    password: "p",
                    service: "https://bsky.social",
                }),
            },
        )
        const res = await callRoute(POST, request)
        expect(res.status).toBe(400)
    })

    it("loginが401相当のエラーで失敗した場合は401を返す", async () => {
        mockedCreateAtpAgent.mockReturnValue({
            login: vi.fn().mockRejectedValue(
                Object.assign(new Error("AuthenticationRequired"), {
                    error: "AuthenticationRequired",
                }),
            ),
        } as any)
        const request = new Request(
            "https://skyshare.nekono.dev/v2/bsky/session/",
            {
                method: "POST",
                body: JSON.stringify({
                    identifier: "alice",
                    password: "wrong",
                    service: "https://bsky.social",
                }),
            },
        )
        const res = await callRoute(POST, request)
        expect(res.status).toBe(401)
    })

    it("loginが429相当のエラーで失敗した場合は429を返す", async () => {
        mockedCreateAtpAgent.mockReturnValue({
            login: vi.fn().mockRejectedValue(
                Object.assign(new Error("RateLimitExceeded"), {
                    error: "RateLimitExceeded",
                }),
            ),
        } as any)
        const request = new Request(
            "https://skyshare.nekono.dev/v2/bsky/session/",
            {
                method: "POST",
                body: JSON.stringify({
                    identifier: "alice",
                    password: "wrong",
                    service: "https://bsky.social",
                }),
            },
        )
        const res = await callRoute(POST, request)
        expect(res.status).toBe(429)
    })

    it("loginがそれ以外のエラーで失敗した場合は500を返す", async () => {
        mockedCreateAtpAgent.mockReturnValue({
            login: vi.fn().mockRejectedValue(new Error("boom")),
        } as any)
        const request = new Request(
            "https://skyshare.nekono.dev/v2/bsky/session/",
            {
                method: "POST",
                body: JSON.stringify({
                    identifier: "alice",
                    password: "wrong",
                    service: "https://bsky.social",
                }),
            },
        )
        const res = await callRoute(POST, request)
        expect(res.status).toBe(500)
    })

    it("初回ログイン(currentSession無し)は200でpool空のままcookieをセットする", async () => {
        mockedCreateAtpAgent.mockReturnValue({
            login: vi.fn().mockResolvedValue({
                data: { did: "did:plc:new", handle: "new.bsky.social" },
            }),
        } as any)
        const request = new Request(
            "https://skyshare.nekono.dev/v2/bsky/session/",
            {
                method: "POST",
                body: JSON.stringify({
                    identifier: "alice",
                    password: "correct",
                    service: "https://bsky.social",
                }),
            },
        )
        const res = await callRoute(POST, request)
        expect(res.status).toBe(200)
        const setCookies = res.headers.getSetCookie()
        expect(
            setCookies.some(c => c.startsWith(`${SESSION_COOKIE_NAME}=`)),
        ).toBe(true)
        expect(
            setCookies.some(c => c.startsWith(`${ACCOUNTS_COOKIE_NAME}=;`)),
        ).toBe(true)
    })

    it("同一did再ログインの場合はpoolへ退避しない", async () => {
        mockedCreateAtpAgent.mockReturnValue({
            login: vi.fn().mockResolvedValue({
                data: { did: "did:plc:same", handle: "same.bsky.social" },
            }),
        } as any)
        const request = new Request(
            "https://skyshare.nekono.dev/v2/bsky/session/",
            {
                method: "POST",
                headers: {
                    cookie: buildSessionCookie({
                        did: "did:plc:same",
                        handle: "same.bsky.social",
                    }),
                },
                body: JSON.stringify({
                    identifier: "same",
                    password: "correct",
                    service: "https://bsky.social",
                }),
            },
        )
        const res = await callRoute(POST, request)
        expect(res.status).toBe(200)
        const setCookies = res.headers.getSetCookie()
        expect(
            setCookies.some(c => c.startsWith(`${ACCOUNTS_COOKIE_NAME}=;`)),
        ).toBe(true)
    })

    it("別アカウントが既にアクティブな状態からの追加ログインで現在のアカウントがpoolへ退避される", async () => {
        mockedCreateAtpAgent.mockReturnValue({
            login: vi.fn().mockResolvedValue({
                data: { did: "did:plc:new", handle: "new.bsky.social" },
            }),
        } as any)
        const request = new Request(
            "https://skyshare.nekono.dev/v2/bsky/session/",
            {
                method: "POST",
                headers: {
                    cookie: buildSessionCookie({
                        did: "did:plc:current",
                        handle: "current.bsky.social",
                    }),
                },
                body: JSON.stringify({
                    identifier: "new",
                    password: "correct",
                    service: "https://bsky.social",
                }),
            },
        )
        const res = await callRoute(POST, request)
        expect(res.status).toBe(200)
        const setCookies = res.headers.getSetCookie()
        const accountsCookie = setCookies.find(c =>
            c.startsWith(`${ACCOUNTS_COOKIE_NAME}=`),
        )
        expect(accountsCookie).toBeDefined()
        expect(accountsCookie).not.toMatch(`${ACCOUNTS_COOKIE_NAME}=;`)
    })

    it("pool上限に達している場合は400を返す", async () => {
        mockedCreateAtpAgent.mockReturnValue({
            login: vi.fn().mockResolvedValue({
                data: { did: "did:plc:new", handle: "new.bsky.social" },
            }),
        } as any)
        const pooledAccounts = Array.from(
            { length: MAX_POOLED_ACCOUNTS },
            (_, i) => ({
                did: `did:plc:pooled${i}`,
                handle: `pooled${i}.bsky.social`,
                service: "https://bsky.social",
                session: {},
                addedAt: "2024-01-01T00:00:00.000Z",
            }),
        )
        const request = new Request(
            "https://skyshare.nekono.dev/v2/bsky/session/",
            {
                method: "POST",
                headers: {
                    cookie: [
                        buildSessionCookie({
                            did: "did:plc:current",
                            handle: "current.bsky.social",
                        }),
                        buildAccountsCookie(pooledAccounts),
                    ].join("; "),
                },
                body: JSON.stringify({
                    identifier: "new",
                    password: "correct",
                    service: "https://bsky.social",
                }),
            },
        )
        const res = await callRoute(POST, request)
        expect(res.status).toBe(400)
    })
})

describe("PUT /v2/bsky/session", () => {
    const targetSession = {
        did: "did:plc:target",
        handle: "target.bsky.social",
        accessJwt: "old-access",
        refreshJwt: "old-refresh",
    }
    const pooledTarget = {
        did: targetSession.did,
        handle: targetSession.handle,
        service: "https://bsky.social",
        session: targetSession,
        addedAt: "2024-01-01T00:00:00.000Z",
    }

    it("bodyがスキーマ不正(did欠落)の場合は400を返す", async () => {
        const request = new Request(
            "https://skyshare.nekono.dev/v2/bsky/session/",
            { method: "PUT", body: JSON.stringify({}) },
        )
        const res = await callRoute(PUT, request)
        expect(res.status).toBe(400)
    })

    it("対象didがpoolに見つからない場合は404を返す", async () => {
        const request = new Request(
            "https://skyshare.nekono.dev/v2/bsky/session/",
            {
                method: "PUT",
                body: JSON.stringify({ did: "did:plc:unknown" }),
            },
        )
        const res = await callRoute(PUT, request)
        expect(res.status).toBe(404)
    })

    it("resumeSessionが401相当のエラーで失敗した場合は401を返す", async () => {
        mockedCreateAtpAgent.mockReturnValue({
            resumeSession: vi.fn().mockRejectedValue(
                Object.assign(new Error("ExpiredToken"), {
                    error: "ExpiredToken",
                }),
            ),
        } as any)
        const request = new Request(
            "https://skyshare.nekono.dev/v2/bsky/session/",
            {
                method: "PUT",
                headers: { cookie: buildAccountsCookie([pooledTarget]) },
                body: JSON.stringify({ did: targetSession.did }),
            },
        )
        const res = await callRoute(PUT, request)
        expect(res.status).toBe(401)
    })

    it("resumeSessionがそれ以外のエラーで失敗した場合は500を返す", async () => {
        mockedCreateAtpAgent.mockReturnValue({
            resumeSession: vi
                .fn()
                .mockRejectedValue(new Error("unexpected boom")),
        } as any)
        const request = new Request(
            "https://skyshare.nekono.dev/v2/bsky/session/",
            {
                method: "PUT",
                headers: { cookie: buildAccountsCookie([pooledTarget]) },
                body: JSON.stringify({ did: targetSession.did }),
            },
        )
        const res = await callRoute(PUT, request)
        expect(res.status).toBe(500)
    })

    it("成功時はローテーション後のagent.sessionを採用してcookieをセットする", async () => {
        const rotated = {
            ...targetSession,
            accessJwt: "new-access",
            refreshJwt: "new-refresh",
        }
        mockedCreateAtpAgent.mockReturnValue({
            resumeSession: vi.fn().mockResolvedValue(undefined),
            session: rotated,
        } as any)
        const request = new Request(
            "https://skyshare.nekono.dev/v2/bsky/session/",
            {
                method: "PUT",
                headers: { cookie: buildAccountsCookie([pooledTarget]) },
                body: JSON.stringify({ did: targetSession.did }),
            },
        )
        const res = await callRoute(PUT, request)
        expect(res.status).toBe(200)
        const setCookies = res.headers.getSetCookie()
        const sessionCookie = setCookies.find(c =>
            c.startsWith(`${SESSION_COOKIE_NAME}=`),
        )
        expect(sessionCookie).toBeDefined()
        const decoded = JSON.parse(
            Buffer.from(
                sessionCookie!.split("=")[1].split(";")[0],
                "base64",
            ).toString("utf-8"),
        )
        expect(decoded.session.accessJwt).toBe("new-access")
    })

    it("agent.sessionが無い場合はtarget.sessionへフォールバックする", async () => {
        mockedCreateAtpAgent.mockReturnValue({
            resumeSession: vi.fn().mockResolvedValue(undefined),
            // session プロパティ無し
        } as any)
        const request = new Request(
            "https://skyshare.nekono.dev/v2/bsky/session/",
            {
                method: "PUT",
                headers: { cookie: buildAccountsCookie([pooledTarget]) },
                body: JSON.stringify({ did: targetSession.did }),
            },
        )
        const res = await callRoute(PUT, request)
        expect(res.status).toBe(200)
        const setCookies = res.headers.getSetCookie()
        const sessionCookie = setCookies.find(c =>
            c.startsWith(`${SESSION_COOKIE_NAME}=`),
        )
        const decoded = JSON.parse(
            Buffer.from(
                sessionCookie!.split("=")[1].split(";")[0],
                "base64",
            ).toString("utf-8"),
        )
        expect(decoded.session.accessJwt).toBe(targetSession.accessJwt)
    })

    it("現在アクティブなアカウントがある場合、切り替え後はpoolへ戻される", async () => {
        mockedCreateAtpAgent.mockReturnValue({
            resumeSession: vi.fn().mockResolvedValue(undefined),
            session: targetSession,
        } as any)
        const request = new Request(
            "https://skyshare.nekono.dev/v2/bsky/session/",
            {
                method: "PUT",
                headers: {
                    cookie: [
                        buildSessionCookie({
                            did: "did:plc:current",
                            handle: "current.bsky.social",
                        }),
                        buildAccountsCookie([pooledTarget]),
                    ].join("; "),
                },
                body: JSON.stringify({ did: targetSession.did }),
            },
        )
        const res = await callRoute(PUT, request)
        expect(res.status).toBe(200)
        const setCookies = res.headers.getSetCookie()
        const accountsCookie = setCookies.find(c =>
            c.startsWith(`${ACCOUNTS_COOKIE_NAME}=`),
        )
        expect(accountsCookie).not.toMatch(`${ACCOUNTS_COOKIE_NAME}=;`)
        const decoded = JSON.parse(
            Buffer.from(
                accountsCookie!.split("=")[1].split(";")[0],
                "base64",
            ).toString("utf-8"),
        )
        expect(decoded.map((a: any) => a.did)).toEqual(["did:plc:current"])
    })

    it("現在アクティブなアカウントが無い場合、poolは残りのアカウントのみになる", async () => {
        mockedCreateAtpAgent.mockReturnValue({
            resumeSession: vi.fn().mockResolvedValue(undefined),
            session: targetSession,
        } as any)
        const request = new Request(
            "https://skyshare.nekono.dev/v2/bsky/session/",
            {
                method: "PUT",
                headers: { cookie: buildAccountsCookie([pooledTarget]) },
                body: JSON.stringify({ did: targetSession.did }),
            },
        )
        const res = await callRoute(PUT, request)
        expect(res.status).toBe(200)
        const setCookies = res.headers.getSetCookie()
        expect(
            setCookies.some(c => c.startsWith(`${ACCOUNTS_COOKIE_NAME}=;`)),
        ).toBe(true)
    })
})
