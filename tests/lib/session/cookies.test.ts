import { afterEach, describe, expect, it, vi } from "vitest"

import {
    admitSession,
    decodeBase64Utf8,
    encodeBase64Utf8,
    getCookieFromHeader,
    makeAccountsSetCookies,
    makeClearSetCookie,
    makeSessionSetCookie,
    MAX_POOLED_ACCOUNTS,
    parseAccountsFromRequest,
    parseCookies,
    parseSessionFromRequest,
    sessionIdentity,
    toPooledAccount,
    upsertPooledAccount,
    type OAuthSession,
    type PasswordSession,
    type PooledAccount,
} from "@/lib/session/cookies"

describe("parseCookies", () => {
    it("複数cookieをパースする", () => {
        expect(parseCookies("a=1; b=2")).toEqual({ a: "1", b: "2" })
    })

    it("空文字は空オブジェクト", () => {
        expect(parseCookies("")).toEqual({})
        expect(parseCookies()).toEqual({})
    })

    it("値はdecodeURIComponentされる", () => {
        expect(parseCookies("a=hello%20world")).toEqual({ a: "hello world" })
    })
})

describe("getCookieFromHeader", () => {
    it("指定した名前の値を返す", () => {
        expect(getCookieFromHeader("a=1; b=2", "b")).toBe("2")
    })

    it("見つからなければ undefined", () => {
        expect(getCookieFromHeader("a=1", "b")).toBeUndefined()
    })
})

describe("encodeBase64Utf8 / decodeBase64Utf8", () => {
    afterEach(() => {
        vi.unstubAllGlobals()
    })

    it("Buffer がある環境で日本語文字列をround-tripできる", () => {
        const encoded = encodeBase64Utf8("こんにちは")
        expect(decodeBase64Utf8(encoded)).toBe("こんにちは")
    })

    it("Buffer が無い環境(Workers相当)でも日本語文字列をround-tripできる", () => {
        vi.stubGlobal("Buffer", undefined)
        const encoded = encodeBase64Utf8("こんにちは")
        expect(decodeBase64Utf8(encoded)).toBe("こんにちは")
    })
})

/** テスト用のアプリパスワードのセッション */
const password = (did: string, handle = `${did}.test`): PasswordSession => ({
    kind: "password",
    session: {
        did,
        handle,
        accessJwt: "ACCESS",
        refreshJwt: "REFRESH",
        active: true,
    },
    service: "https://x",
})

/** テスト用の OAuth のセッション（実際の大きさに近い値を入れる） */
const oauth = (did: string): OAuthSession => ({
    kind: "oauth",
    did,
    handle: `${did}.test`,
    pds: "https://morel.us-east.host.bsky.network",
    oauth: {
        accessToken: "a".repeat(700),
        expiresAt: 1_800_000_000,
        refreshToken: `ref-${"r".repeat(64)}`,
        dpopJwk: {
            kty: "EC",
            crv: "P-256",
            x: "x".repeat(43),
            y: "y".repeat(43),
            d: "d".repeat(43),
        },
        issuer: "https://bsky.social",
        tokenEndpoint: "https://bsky.social/oauth/token",
        revocationEndpoint: "https://bsky.social/oauth/revoke",
        clientId: "https://skyshare.example.com/oauth/client-metadata.json",
    },
})

const pooled = (s: PasswordSession | OAuthSession): PooledAccount => ({
    ...s,
    addedAt: "2026-01-01T00:00:00.000Z",
})

/** `Set-Cookie` の一覧を、要求の `Cookie` ヘッダーにまとめる */
const toCookieHeader = (setCookies: string[]) =>
    setCookies
        .filter(c => !c.includes("Max-Age=0"))
        .map(c => c.split(";")[0])
        .join("; ")

describe("parseSessionFromRequest", () => {
    it("[account-session/1.1] atp_session cookie を復号してセッションを取得する", () => {
        for (const stored of [password("did:plc:abc"), oauth("did:plc:abc")]) {
            const request = new Request("https://example.com", {
                headers: {
                    cookie: makeSessionSetCookie(stored).split(";")[0]!,
                },
            })
            expect(parseSessionFromRequest(request)).toEqual(stored)
        }
    })

    it("kind の無い以前の形式はアプリパスワードのセッションとして読む", () => {
        const payload = {
            session: { did: "did:plc:abc", handle: "alice.test" },
            service: "https://x",
        }
        const request = new Request("https://example.com", {
            headers: {
                cookie: `atp_session=${encodeBase64Utf8(JSON.stringify(payload))}`,
            },
        })
        expect(parseSessionFromRequest(request)).toEqual({
            kind: "password",
            ...payload,
        })
    })

    it("cookieが無ければ undefined", () => {
        const request = new Request("https://example.com")
        expect(parseSessionFromRequest(request)).toBeUndefined()
    })
})

describe("makeSessionSetCookie", () => {
    it("[account-session/1.1] Set-Cookie文字列に必要な属性を含む", () => {
        const cookie = makeSessionSetCookie(password("did:plc:abc"))
        expect(cookie).toContain("atp_session=")
        expect(cookie).toContain("Path=/")
        expect(cookie).toContain("HttpOnly")
        expect(cookie).toContain("SameSite=Strict")
    })
})

describe("makeClearSetCookie", () => {
    it("Max-Age=0で即時失効させる", () => {
        const cookie = makeClearSetCookie("atp_account_0")
        expect(cookie).toContain("atp_account_0=")
        expect(cookie).toContain("Max-Age=0")
    })
})

describe("プールの枠の cookie", () => {
    it("[account-session/1.2] プールの2件がそれぞれ別の cookie に入り、空いた枠の cookie は失効する", () => {
        const pool = [pooled(oauth("did:plc:a")), pooled(password("did:plc:b"))]
        const cookies = makeAccountsSetCookies(pool)
        expect(cookies).toHaveLength(MAX_POOLED_ACCOUNTS)
        expect(cookies[0]).toMatch(/^atp_account_0=[^;]+;/)
        expect(cookies[1]).toMatch(/^atp_account_1=[^;]+;/)
        expect(cookies[2]).toMatch(/^atp_account_2=;.*Max-Age=0/)
        expect(cookies[3]).toMatch(/^atp_account_3=;.*Max-Age=0/)
        for (const cookie of cookies) expect(cookie).toContain("HttpOnly")

        const request = new Request("https://example.com", {
            headers: { cookie: toCookieHeader(cookies) },
        })
        expect(parseAccountsFromRequest(request)).toEqual(pool)
    })

    it("OAuth のセッションでも、1件の cookie が上限の4キロバイトに収まる", () => {
        const cookies = makeAccountsSetCookies(
            Array.from({ length: MAX_POOLED_ACCOUNTS }, (_, i) =>
                pooled(oauth(`did:plc:${"a".repeat(24)}${i}`)),
            ),
        )
        for (const cookie of cookies) {
            expect(cookie.split(";")[0]!.length).toBeLessThan(4096)
        }
    })

    it("cookieが無ければ空配列、壊れた枠は飛ばす", () => {
        expect(
            parseAccountsFromRequest(new Request("https://example.com")),
        ).toEqual([])
        const good = makeAccountsSetCookies([pooled(password("did:plc:b"))])
        const request = new Request("https://example.com", {
            headers: {
                cookie: `atp_account_0=not-valid; ${good[0]!.split(";")[0]!.replace("atp_account_0", "atp_account_1")}`,
            },
        })
        expect(parseAccountsFromRequest(request)).toEqual([
            pooled(password("did:plc:b")),
        ])
    })
})

describe("toPooledAccount / upsertPooledAccount", () => {
    it("セッションに退避した時刻を付ける", () => {
        const result = toPooledAccount(password("did:plc:abc"))
        expect(result).toMatchObject(password("did:plc:abc"))
        expect(typeof result.addedAt).toBe("string")
    })

    it("新規didは末尾に追加し、同一didは上書きして末尾に配置する", () => {
        const existing = pooled(password("did:plc:abc"))
        const other = pooled(oauth("did:plc:other"))
        expect(upsertPooledAccount([existing], other)).toEqual([
            existing,
            other,
        ])
        const updated = pooled(password("did:plc:abc", "alice2.test"))
        expect(upsertPooledAccount([existing, other], updated)).toEqual([
            other,
            updated,
        ])
    })
})

describe("admitSession", () => {
    it("別アカウントがアクティブなら退避し、同じアカウントなら退避しない", () => {
        const a = password("did:plc:a")
        const b = oauth("did:plc:b")
        const result = admitSession(a, [], b)!
        expect(result.map(account => sessionIdentity(account).did)).toEqual([
            "did:plc:a",
        ])
        expect(admitSession(b, [], oauth("did:plc:b"))).toEqual([])
        // 新しいアカウントがプールにあれば除く
        expect(admitSession(undefined, [pooled(b)], b)).toEqual([])
    })

    it("プールが上限のとき、別アカウントの退避は null になる", () => {
        const full = Array.from({ length: MAX_POOLED_ACCOUNTS }, (_, i) =>
            pooled(password(`did:plc:p${i}`)),
        )
        expect(
            admitSession(password("did:plc:a"), full, oauth("did:plc:b")),
        ).toBeNull()
        // プールにいるアカウントへのログインは、枠が空くため退避できる
        expect(
            admitSession(password("did:plc:a"), full, password("did:plc:p0")),
        ).toHaveLength(MAX_POOLED_ACCOUNTS)
    })
})
