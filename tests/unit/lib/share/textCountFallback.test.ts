/**
 * Verifies fallback character counts when the X length parser throws.
 */
import { describe, expect, it, vi } from "vitest"

vi.mock("twitter-text", () => ({
    default: {
        parseTweet: () => {
            throw new Error("計量の失敗（テスト用）")
        },
    },
}))

import { countWeightedTweetLength } from "@/lib/share/textCount"
import { resolveIntentMeasure } from "@/lib/share/intentLength"

describe("fallback values when length measurement throws", () => {
    it("returns the string length as the X fallback count", () => {
        expect(countWeightedTweetLength("abcd")).toBe(4)
    })

    it("returns twice the string length as the X measurement", () => {
        expect(resolveIntentMeasure("x")("abcd")).toBe(8)
    })
})
