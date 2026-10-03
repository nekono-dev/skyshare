import { describe, expect, it } from "vitest"

import {
    LANGUAGE_REPRESENTATIVE_COUNTRY,
    languageCodeToFlagEmoji,
} from "@/lib/atproto/languageFlag"
import { BLUESKY_POST_LANGUAGES } from "@/components/common/LanguageSelect"

describe("languageCodeToFlagEmoji", () => {
    it("代表国の国旗を返す", () => {
        expect(languageCodeToFlagEmoji("ja")).toBe("🇯🇵")
        expect(languageCodeToFlagEmoji("en")).toBe("🇺🇸")
    })

    it("国に対応しない言語は undefined", () => {
        expect(languageCodeToFlagEmoji("eo")).toBeUndefined()
        expect(languageCodeToFlagEmoji("la")).toBeUndefined()
    })

    it("対応表の値はすべて大文字2文字の国コード", () => {
        for (const country of Object.values(LANGUAGE_REPRESENTATIVE_COUNTRY)) {
            expect(country).toMatch(/^[A-Z]{2}$/)
        }
    })

    it("対応表のキーはすべて投稿言語一覧に存在する", () => {
        const codes = new Set(BLUESKY_POST_LANGUAGES.map(l => l.code))
        for (const code of Object.keys(LANGUAGE_REPRESENTATIVE_COUNTRY)) {
            expect(codes.has(code)).toBe(true)
        }
    })
})
