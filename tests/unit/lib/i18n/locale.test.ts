// 表示言語の判定（P0・要件 2.1 の「表示言語の判定」）: 保存された値、ブラウザの言語、既定と非対応の退避
import { describe, expect, it } from "vitest"
import {
    DEFAULT_LOCALE,
    parseAcceptLanguage,
    pickLocaleFromLanguages,
    resolveLocale,
    UNSUPPORTED_LANGUAGE_LOCALE,
} from "@/lib/i18n/locale"

describe("resolveLocale", () => {
    it("prefers a stored supported locale over the browser languages", () => {
        expect(resolveLocale("en", ["ja-JP"])).toBe("en")
    })

    it("ignores a stored value that is not a supported locale and falls back to the browser languages", () => {
        expect(resolveLocale("fr", ["en-US"])).toBe("en")
        expect(resolveLocale("system", ["ja-JP"])).toBe("ja")
    })

    it("uses the default locale when the browser sends no language", () => {
        expect(resolveLocale(null, [])).toBe(DEFAULT_LOCALE)
    })

    it("falls back to the unsupported-language locale when no browser language is supported", () => {
        expect(resolveLocale(undefined, ["fr-FR", "de"])).toBe(
            UNSUPPORTED_LANGUAGE_LOCALE,
        )
    })
})

describe("pickLocaleFromLanguages", () => {
    it("takes the primary subtag regardless of region and case", () => {
        expect(pickLocaleFromLanguages(["EN-us"])).toBe("en")
        expect(pickLocaleFromLanguages(["ja-JP"])).toBe("ja")
    })

    it("returns the first supported language in order", () => {
        expect(pickLocaleFromLanguages(["fr", "ja", "en"])).toBe("ja")
    })

    it("returns undefined when no language is supported", () => {
        expect(pickLocaleFromLanguages(["fr"])).toBeUndefined()
    })
})

describe("parseAcceptLanguage", () => {
    it("orders by quality and drops entries with q=0 and the wildcard", () => {
        expect(parseAcceptLanguage("en;q=0.5, ja;q=0.9, fr;q=0, *")).toEqual([
            "ja",
            "en",
        ])
    })

    it("returns an empty list for a missing header", () => {
        expect(parseAcceptLanguage(null)).toEqual([])
    })
})

describe("parseAcceptLanguage (malformed entries)", () => {
    it("treats an unreadable q value as 1 and skips empty entries", () => {
        expect(parseAcceptLanguage("en;q=abc, ,ja")).toEqual(["en", "ja"])
    })
})
