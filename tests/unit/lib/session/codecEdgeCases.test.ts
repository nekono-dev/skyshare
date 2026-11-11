/**
 * Verifies base64 and Cookie parsing across runtime edge cases.
 *
 * - Workers lack Node’s Buffer, so base64 conversion must use web APIs.
 */
import { afterEach, describe, expect, it, vi } from "vitest"
import {
    decodeBase64Json,
    decodeBase64Utf8,
    encodeBase64Utf8,
    getCookieFromHeader,
    parseCookies,
} from "@/lib/session/cookies/codec"

afterEach(() => {
    vi.unstubAllGlobals()
})

describe("codec: base64 UTF-8 conversion without Buffer", () => {
    // Cloudflare Workers には Node の Buffer が無いため、Web 標準 API の経路を検証する
    const hideBuffer = () => vi.stubGlobal("Buffer", undefined)

    it("encodes UTF-8 text to the standard base64 without Buffer", () => {
        hideBuffer()
        // 「日本語」の UTF-8 バイト列 E6 97 A5 E6 9C AC E8 AA 9E を base64 にした値
        expect(encodeBase64Utf8("日本語")).toBe("5pel5pys6Kqe")
    })

    it("decodes base64 to UTF-8 text without Buffer", () => {
        hideBuffer()
        expect(decodeBase64Utf8("5pel5pys6Kqe")).toBe("日本語")
    })

    it("round-trips ASCII and multibyte text without Buffer", () => {
        hideBuffer()
        const text = "abc 😀 あいう"
        expect(decodeBase64Utf8(encodeBase64Utf8(text))).toBe(text)
    })

    it("uses Buffer when it is available and gives the same base64", () => {
        // 比較のために Buffer の経路も、既知の値で確かめる
        expect(encodeBase64Utf8("日本語")).toBe("5pel5pys6Kqe")
        expect(decodeBase64Utf8("5pel5pys6Kqe")).toBe("日本語")
    })

    it("decodes a session JSON without Buffer through decodeBase64Json", () => {
        hideBuffer()
        const raw = encodeBase64Utf8(
            JSON.stringify({ kind: "password", n: "名" }),
        )
        expect(decodeBase64Json(raw)).toEqual({ kind: "password", n: "名" })
    })

    it("throws the fixed message from decodeBase64Json when the base64 is not JSON", () => {
        expect(() => decodeBase64Json(encodeBase64Utf8("not json"))).toThrow(
            new Error("invalid session cookie"),
        )
    })

    it("throws the fixed message from decodeBase64Json without Buffer for invalid base64", () => {
        hideBuffer()
        // atob は base64 の文字集合に無い文字を含むと例外を投げる
        expect(() => decodeBase64Json("%%%")).toThrow(
            new Error("invalid session cookie"),
        )
    })
})

describe("codec: parses Cookie headers", () => {
    it("returns an empty object for an empty header", () => {
        expect(parseCookies("")).toEqual({})
        expect(parseCookies()).toEqual({})
    })

    it("skips an entry without '=' and keeps the other entries", () => {
        expect(parseCookies("a=1; flag; b=2")).toEqual({ a: "1", b: "2" })
    })

    it("skips empty entries produced by stray separators", () => {
        expect(parseCookies(";; a=1 ;")).toEqual({ a: "1" })
    })

    it("keeps everything after the first '=' as the value", () => {
        expect(parseCookies("token=x=y==")).toEqual({ token: "x=y==" })
    })

    it("decodes percent-encoded values", () => {
        expect(parseCookies("name=%E6%97%A5")).toEqual({ name: "日" })
    })

    it("keeps a value with an invalid percent-encoding as it is, without losing the other values", () => {
        // decodeURIComponent は不正な UTF-8 のエンコードで例外を投げるため、その値だけ生のまま残す
        expect(parseCookies("bad=%E3%81; good=%E6%97%A5")).toEqual({
            bad: "%E3%81",
            good: "日",
        })
    })

    it("returns the value of a named cookie and undefined when it is missing", () => {
        const header = "a=1; b=%E6%97%A5"
        expect(getCookieFromHeader(header, "b")).toBe("日")
        expect(getCookieFromHeader(header, "missing")).toBeUndefined()
        expect(getCookieFromHeader("", "a")).toBeUndefined()
    })
})
