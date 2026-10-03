import { describe, expect, it } from "vitest"

import { countryCodeToFlagEmoji } from "@/util/emoji/countryFlag"

describe("countryCodeToFlagEmoji", () => {
    it("JP は日本の国旗絵文字になる", () => {
        expect(countryCodeToFlagEmoji("JP")).toBe("🇯🇵")
    })

    it("小文字も変換できる", () => {
        expect(countryCodeToFlagEmoji("kr")).toBe("🇰🇷")
    })

    it("2文字の英字以外は undefined", () => {
        expect(countryCodeToFlagEmoji("")).toBeUndefined()
        expect(countryCodeToFlagEmoji("J")).toBeUndefined()
        expect(countryCodeToFlagEmoji("JPN")).toBeUndefined()
        expect(countryCodeToFlagEmoji("1P")).toBeUndefined()
    })
})
