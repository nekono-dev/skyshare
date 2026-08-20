import { afterEach, describe, expect, it, vi } from "vitest"

import {
    decodeBase64Utf8,
    encodeBase64Utf8,
    getCookieFromHeader,
    makeAccountsSetCookie,
    makeClearSetCookie,
    makeSessionSetCookie,
    parseAccountsFromRequest,
    parseCookies,
    parseSessionFromRequest,
    toPooledAccount,
    upsertPooledAccount,
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

describe("parseSessionFromRequest", () => {
    it("atp_session cookie を復号してsession/serviceを取得する", () => {
        const payload = { session: { did: "did:plc:abc" }, service: "https://x" }
        const cookieVal = encodeBase64Utf8(JSON.stringify(payload))
        const request = new Request("https://example.com", {
            headers: { cookie: `atp_session=${cookieVal}` },
        })
        expect(parseSessionFromRequest(request)).toEqual({
            session: { did: "did:plc:abc" },
            service: "https://x",
        })
    })

    it("cookieが無ければsession/serviceともundefined", () => {
        const request = new Request("https://example.com")
        expect(parseSessionFromRequest(request)).toEqual({
            session: undefined,
            service: undefined,
        })
    })
})

describe("makeSessionSetCookie", () => {
    it("Set-Cookie文字列に必要な属性を含む", () => {
        const cookie = makeSessionSetCookie({ did: "did:plc:abc" })
        expect(cookie).toContain("atp_session=")
        expect(cookie).toContain("Path=/")
        expect(cookie).toContain("HttpOnly")
        expect(cookie).toContain("SameSite=Strict")
    })
})

describe("makeClearSetCookie", () => {
    it("Max-Age=0で即時失効させる", () => {
        const cookie = makeClearSetCookie("atp_accounts")
        expect(cookie).toContain("atp_accounts=")
        expect(cookie).toContain("Max-Age=0")
    })
})

describe("parseAccountsFromRequest", () => {
    it("妥当なPooledAccount配列のみを返す", () => {
        const accounts = [
            {
                did: "did:plc:abc",
                handle: "alice.bsky.social",
                service: "https://x",
                session: {},
                addedAt: "2026-01-01T00:00:00Z",
            },
        ]
        const cookieVal = encodeBase64Utf8(JSON.stringify(accounts))
        const request = new Request("https://example.com", {
            headers: { cookie: `atp_accounts=${cookieVal}` },
        })
        expect(parseAccountsFromRequest(request)).toEqual(accounts)
    })

    it("cookieが無ければ空配列", () => {
        const request = new Request("https://example.com")
        expect(parseAccountsFromRequest(request)).toEqual([])
    })

    it("壊れたcookieでも空配列にフォールバックする", () => {
        const request = new Request("https://example.com", {
            headers: { cookie: "atp_accounts=not-valid-base64-json" },
        })
        expect(parseAccountsFromRequest(request)).toEqual([])
    })
})

describe("makeAccountsSetCookie", () => {
    it("空配列の場合はcookieを失効させる", () => {
        const cookie = makeAccountsSetCookie([])
        expect(cookie).toContain("Max-Age=0")
    })

    it("アカウントがあればエンコードした値を設定する", () => {
        const cookie = makeAccountsSetCookie([
            {
                did: "did:plc:abc",
                handle: "alice.bsky.social",
                service: "https://x",
                session: {},
                addedAt: "2026-01-01T00:00:00Z",
            },
        ])
        expect(cookie).toContain("atp_accounts=")
        expect(cookie).not.toContain("Max-Age=0")
    })
})

describe("toPooledAccount", () => {
    it("sessionからPooledAccountを組み立てる", () => {
        const result = toPooledAccount(
            { did: "did:plc:abc", handle: "alice.bsky.social" },
            "https://x",
        )
        expect(result).toMatchObject({
            did: "did:plc:abc",
            handle: "alice.bsky.social",
            service: "https://x",
        })
        expect(typeof result.addedAt).toBe("string")
    })
})

describe("upsertPooledAccount", () => {
    const existing = {
        did: "did:plc:abc",
        handle: "alice.bsky.social",
        service: "https://x",
        session: {},
        addedAt: "2026-01-01T00:00:00Z",
    }

    it("新規didは末尾に追加する", () => {
        const other = { ...existing, did: "did:plc:other" }
        expect(upsertPooledAccount([existing], other)).toEqual([
            existing,
            other,
        ])
    })

    it("同一didは上書きし末尾に配置する", () => {
        const updated = { ...existing, handle: "alice2.bsky.social" }
        expect(upsertPooledAccount([existing], updated)).toEqual([updated])
    })
})
