import { describe, expect, it } from "vitest"

import {
    countGraphemes,
    countTaittsuuLength,
    countWeightedTweetLength,
} from "@/util/textCount"

describe("countGraphemes", () => {
    it("[counted-text-input/AC-1] 結合文字を含む絵文字を1文字として数える", () => {
        expect(countGraphemes("👨‍👩‍👧")).toBe(1)
        expect(countGraphemes("éa")).toBe(2)
    })
})

describe("countWeightedTweetLength", () => {
    it("[counted-text-input/AC-2] 全角は1、半角2文字は1、URLは長さによらず12として数える", () => {
        expect(countWeightedTweetLength("あい")).toBe(2)
        expect(countWeightedTweetLength("abcd")).toBe(2)
        const short = countWeightedTweetLength("https://example.com/a")
        const long = countWeightedTweetLength(
            "https://example.com/" + "a".repeat(100),
        )
        expect(long).toBe(short)
        expect(long).toBe(12)
    })
})

describe("countTaittsuuLength", () => {
    it("[counted-text-input/AC-3] 全角は1、半角2文字は1、URLも全文字を数える", () => {
        expect(countTaittsuuLength("あい")).toBe(2)
        expect(countTaittsuuLength("ab")).toBe(1)
        expect(countTaittsuuLength("https://example.com/a".repeat(2))).toBe(
            Math.ceil(("https://example.com/a".length * 2) / 2),
        )
    })
})
