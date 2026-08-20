import { describe, expect, it } from "vitest"

import {
    convertHeaderToObj,
    hasCookieHeader,
    isMultipartFormData,
    parseLimit,
} from "@/util/http"

describe("parseLimit", () => {
    it("未指定(null)は undefined を返す", () => {
        expect(parseLimit(null)).toBeUndefined()
    })

    it("空文字は undefined を返す", () => {
        expect(parseLimit("  ")).toBeUndefined()
    })

    it("1〜100の整数はそのまま number を返す", () => {
        expect(parseLimit("1")).toBe(1)
        expect(parseLimit("100")).toBe(100)
        expect(parseLimit("20")).toBe(20)
    })

    it("範囲外・非整数は null を返す", () => {
        expect(parseLimit("0")).toBeNull()
        expect(parseLimit("101")).toBeNull()
        expect(parseLimit("1.5")).toBeNull()
        expect(parseLimit("abc")).toBeNull()
    })
})

describe("convertHeaderToObj", () => {
    it("Headers をプレーンオブジェクトへ変換する", () => {
        const headers = new Headers({
            "content-type": "application/json",
            cookie: "a=1; b=2",
        })
        expect(convertHeaderToObj(headers)).toEqual({
            "content-type": "application/json",
            cookie: "a=1; b=2",
        })
    })

    it("ヘッダが空なら空オブジェクトを返す", () => {
        expect(convertHeaderToObj(new Headers())).toEqual({})
    })
})

describe("hasCookieHeader", () => {
    it("cookie ヘッダがあれば true を返す", () => {
        const request = new Request("https://example.com", {
            headers: { cookie: "atp_session=xxx" },
        })
        expect(hasCookieHeader(request)).toBe(true)
    })

    it("cookie ヘッダが無ければ false を返す", () => {
        const request = new Request("https://example.com")
        expect(hasCookieHeader(request)).toBe(false)
    })
})

describe("isMultipartFormData", () => {
    it("multipart/form-data を含む Content-Type は true", () => {
        expect(
            isMultipartFormData("multipart/form-data; boundary=----xxx"),
        ).toBe(true)
    })

    it("含まない Content-Type や null は false", () => {
        expect(isMultipartFormData("application/json")).toBe(false)
        expect(isMultipartFormData(null)).toBe(false)
    })
})
