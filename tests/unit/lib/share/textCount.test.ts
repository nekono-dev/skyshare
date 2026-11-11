/**
 * Verifies weighted character counts for supported share targets.
 */
import { describe, expect, it } from "vitest"
import {
    countTaittsuuLength,
    countWeightedTweetLength,
} from "@/lib/share/textCount"

describe("X weighted character counts", () => {
    it.each([
        ["counts an empty body as zero", "", 0],
        ["rounds three ASCII characters up to two", "abc", 2],
        ["counts three full-width characters as three", "あいう", 3],
        ["rounds a mixed full-width and ASCII count up to two", "あa", 2],
        ["rounds ASCII text with a newline up to two", "a\nb", 2],
        [
            "counts a URL as 23 weighted characters, yielding 12",
            "https://example.com/abc",
            12,
        ],
    ])("%s", (_name, text, expected) => {
        expect(countWeightedTweetLength(text)).toBe(expected)
    })
})

describe("Taittsuu character counts", () => {
    it.each([
        ["counts an empty body as zero", "", 0],
        ["rounds three ASCII characters up to two", "abc", 2],
        ["counts three full-width characters as three", "あいう", 3],
        ["rounds a mixed full-width and ASCII count up to two", "あa", 2],
        ["counts an emoji as one character", "😀", 1],
        [
            "counts every URL character, yielding six for a 12-character URL",
            "https://e.co",
            6,
        ],
    ])("%s", (_name, text, expected) => {
        expect(countTaittsuuLength(text)).toBe(expected)
    })
})
