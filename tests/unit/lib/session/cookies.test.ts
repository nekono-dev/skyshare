// セッションの Cookie（P0・要件 2.1 の「セッション処理」）: 読み書き、失敗の種類、プールの上限と枠の扱い
import { afterEach, describe, expect, it, vi } from "vitest"
import {
    admitSession,
    encodeBase64Utf8,
    makeAccountsSetCookies,
    makeSessionSetCookie,
    parseAccountsFromRequest,
    parseSessionFromRequest,
    type OAuthSession,
    type PasswordSession,
    type PooledAccount,
    MAX_POOLED_ACCOUNTS,
} from "@/lib/session/cookies"
import { TEST_DID, TEST_HANDLE } from "../../../fixtures/identities"

const oauthSession = (did: string, handle: string): OAuthSession =>
    ({
        kind: "oauth",
        did,
        handle,
        pds: "https://pds.test",
        oauth: {
            accessToken: "access-token-fixture",
            expiresAt: 1_900_000_000,
            refreshToken: "refresh-token-fixture",
            dpopJwk: { kty: "EC", crv: "P-256", x: "x", y: "y" },
            issuer: "https://bsky.social",
            tokenEndpoint: "https://bsky.social/oauth/token",
            clientId: "https://skyshare.test/client-metadata.json",
        },
    }) as unknown as OAuthSession

const passwordSession = (did: string, handle: string): PasswordSession =>
    ({
        kind: "password",
        session: { did, handle, accessJwt: "a", refreshJwt: "r" },
        service: "https://bsky.social",
    }) as unknown as PasswordSession

/** Set-Cookie の値から、ブラウザが送り返す `name=value` の部分を取り出す */
const cookieValue = (setCookie: string): string =>
    setCookie.slice(0, setCookie.indexOf(";"))

const requestWithCookie = (cookie: string): Request =>
    new Request("https://skyshare.test/", { headers: { cookie } })

afterEach(() => {
    vi.unstubAllEnvs()
})

describe("session cookie: reading", () => {
    it("returns undefined when there is no session cookie", () => {
        expect(
            parseSessionFromRequest(new Request("https://skyshare.test/")),
        ).toBeUndefined()
    })

    it("throws the fixed message for a session cookie that is not Base64 JSON", () => {
        const request = requestWithCookie("atp_session=%%%not-json%%%")
        expect(() => parseSessionFromRequest(request)).toThrow(
            new Error("invalid session cookie"),
        )
    })

    it("returns undefined for a session of an unknown kind", () => {
        const raw = encodeBase64Utf8(
            JSON.stringify({ kind: "unknown", did: TEST_DID }),
        )
        expect(
            parseSessionFromRequest(requestWithCookie(`atp_session=${raw}`)),
        ).toBeUndefined()
    })

    it("returns undefined for an OAuth session that lacks a required token field", () => {
        const broken = oauthSession(TEST_DID, TEST_HANDLE) as unknown as {
            oauth: Record<string, unknown>
        }
        delete broken.oauth.refreshToken
        const raw = encodeBase64Utf8(JSON.stringify(broken))
        expect(
            parseSessionFromRequest(requestWithCookie(`atp_session=${raw}`)),
        ).toBeUndefined()
    })
})

describe("session cookie: writing and round trip", () => {
    it("round-trips an OAuth session through the Set-Cookie value", () => {
        const session = oauthSession(TEST_DID, TEST_HANDLE)
        const setCookie = makeSessionSetCookie(session)
        const read = parseSessionFromRequest(
            requestWithCookie(cookieValue(setCookie)),
        )
        expect(read).toEqual(session)
    })

    it("sets HttpOnly and SameSite=Strict on every session cookie", () => {
        const setCookie = makeSessionSetCookie(
            passwordSession(TEST_DID, TEST_HANDLE),
        )
        expect(setCookie).toContain("HttpOnly")
        expect(setCookie).toContain("SameSite=Strict")
    })

    it("adds Secure only in production", () => {
        vi.stubEnv("PUBLIC_NODE_ENV", "production")
        expect(
            makeSessionSetCookie(passwordSession(TEST_DID, TEST_HANDLE)),
        ).toContain("Secure")
        vi.stubEnv("PUBLIC_NODE_ENV", "development")
        expect(
            makeSessionSetCookie(passwordSession(TEST_DID, TEST_HANDLE)),
        ).not.toContain("Secure")
    })
})

describe("session cookie: account pool", () => {
    it("skips a corrupt account slot and keeps the valid ones", () => {
        const valid = encodeBase64Utf8(
            JSON.stringify({
                ...passwordSession(TEST_DID, TEST_HANDLE),
                addedAt: "2026-10-01T00:00:00.000Z",
            }),
        )
        const request = requestWithCookie(
            `atp_account_0=%%%broken%%%; atp_account_1=${valid}`,
        )
        const pool = parseAccountsFromRequest(request)
        expect(pool.map(a => a.addedAt)).toEqual(["2026-10-01T00:00:00.000Z"])
    })

    it("refuses to admit a new account (null) when the pool is already full", () => {
        const full: PooledAccount[] = Array.from(
            { length: MAX_POOLED_ACCOUNTS },
            (_, i) => ({
                ...passwordSession(
                    `did:plc:testfixturefull${i}0000000000`,
                    `full${i}.test`,
                ),
                addedAt: "2026-10-01T00:00:00.000Z",
            }),
        ) as PooledAccount[]
        const current = passwordSession(
            "did:plc:testfixturecurrent00000000",
            "current.test",
        )
        const incoming = passwordSession(
            "did:plc:testfixtureincoming0000000",
            "incoming.test",
        )
        expect(admitSession(current, full, incoming)).toBeNull()
    })

    it("moves the current account into the pool when a different account is admitted", () => {
        const current = passwordSession(TEST_DID, TEST_HANDLE)
        const incoming = passwordSession(
            "did:plc:testfixtureother00000000000",
            "other.test",
        )
        const next = admitSession(current, [], incoming)
        // 現在のアカウントを枠へ退避する（新しく入るアカウントは枠に入れない）
        expect(
            next?.map(a => (a.kind === "password" ? a.session.did : "oauth")),
        ).toEqual([TEST_DID])
    })

    it("replaces a pooled account with the same DID instead of keeping both", () => {
        const current = passwordSession(
            "did:plc:testfixturecurrent00000000",
            "current.test",
        )
        const pooledOld = {
            ...passwordSession(TEST_DID, "old.test"),
            addedAt: "2026-10-01T00:00:00.000Z",
        } as PooledAccount
        const incomingSame = passwordSession(TEST_DID, "renamed.test")
        const next = admitSession(current, [pooledOld], incomingSame)
        // 同じ DID の古い枠は残さない（現在のアカウントだけを退避する）
        expect(
            next?.map(a =>
                a.kind === "password" ? a.session.handle : "oauth",
            ),
        ).toEqual(["current.test"])
    })

    it("clears the unused slots with Max-Age=0", () => {
        const cookies = makeAccountsSetCookies([])
        expect(cookies).toHaveLength(MAX_POOLED_ACCOUNTS)
        for (const c of cookies) expect(c).toContain("Max-Age=0")
    })
})
