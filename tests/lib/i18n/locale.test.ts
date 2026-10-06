import { describe, expect, it } from "vitest"

import {
    isLocale,
    parseAcceptLanguage,
    pickLocaleFromLanguages,
    resolveLocale,
} from "@/lib/i18n/locale"

describe("isLocale", () => {
    it("対応言語のみ true", () => {
        expect(isLocale("ja")).toBe(true)
        expect(isLocale("en")).toBe(true)
        expect(isLocale("fr")).toBe(false)
        expect(isLocale("system")).toBe(false)
        expect(isLocale(null)).toBe(false)
    })
})

describe("parseAcceptLanguage", () => {
    it("q降順に並べ、q省略は1として扱う", () => {
        expect(parseAcceptLanguage("ja;q=0.5,en-US")).toEqual(["en-US", "ja"])
    })
    it("q同値は記載順を保つ", () => {
        expect(parseAcceptLanguage("fr,en,ja")).toEqual(["fr", "en", "ja"])
    })
    it("q=0 と * は除外する", () => {
        expect(parseAcceptLanguage("en;q=0,*;q=0.1,ja")).toEqual(["ja"])
    })
    it("解釈できないqは1として扱う", () => {
        expect(parseAcceptLanguage("ja;q=abc,en;q=0.5")).toEqual(["ja", "en"])
    })
    it("null/空文字は空配列", () => {
        expect(parseAcceptLanguage(null)).toEqual([])
        expect(parseAcceptLanguage("")).toEqual([])
    })
})

describe("pickLocaleFromLanguages", () => {
    it("地域付きタグは主言語で照合する", () => {
        expect(pickLocaleFromLanguages(["en-GB"])).toBe("en")
        expect(pickLocaleFromLanguages(["JA-jp"])).toBe("ja")
    })
    it("未対応言語を飛ばして最初の一致を返す", () => {
        expect(pickLocaleFromLanguages(["fr-FR", "en-US", "ja"])).toBe("en")
    })
    it("一致なしは undefined", () => {
        expect(pickLocaleFromLanguages(["fr", "de"])).toBeUndefined()
        expect(pickLocaleFromLanguages([])).toBeUndefined()
    })
})

describe("resolveLocale", () => {
    it("保存済み設定がブラウザ言語より優先される", () => {
        expect(resolveLocale("ja", ["en-US"])).toBe("ja")
    })
    it("未保存・不正値はブラウザ言語を使う", () => {
        expect(resolveLocale(null, ["en-US"])).toBe("en")
        expect(resolveLocale(undefined, ["en-US"])).toBe("en")
        expect(resolveLocale("fr", ["en-US"])).toBe("en")
    })
    it("ブラウザ言語が非対応言語のみなら英語", () => {
        expect(resolveLocale(null, ["fr"])).toBe("en")
        expect(resolveLocale(null, ["fr-FR", "de"])).toBe("en")
    })
    it("ブラウザ言語が未設定なら日本語", () => {
        expect(resolveLocale(null, [])).toBe("ja")
    })
})
