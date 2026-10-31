/**
 * 投稿の文字数（X・タイッツー）の換算の特性化テスト（src-duplicates 1.1・要件 1.1〜1.2）。
 * 移す前の現行の値を固定する。振る舞いを変えるためのテストではない。
 */
import { describe, expect, it } from "vitest"
import { countTaittsuuLength, countWeightedTweetLength } from "@/util/textCount"

describe("X の文字数（半角換算を 2 で割って切り上げ）", () => {
    it.each([
        ["空の本文", "", 0],
        ["英字 3 字は 1.5 を切り上げて 2", "abc", 2],
        ["全角 3 字は 6 を 2 で割って 3", "あいう", 3],
        ["全角と英字の混在は 3 を切り上げて 2", "あa", 2],
        ["改行を含む英字は 3 を切り上げて 2", "a\nb", 2],
        ["URL は長さに関わらず 23 として 12", "https://example.com/abc", 12],
    ])("%s", (_name, text, expected) => {
        expect(countWeightedTweetLength(text)).toBe(expected)
    })
})

describe("タイッツーの文字数（全角 2・半角 1 を単純加算して 2 で割って切り上げ）", () => {
    it.each([
        ["空の本文", "", 0],
        ["英字 3 字は 1.5 を切り上げて 2", "abc", 2],
        ["全角 3 字は 6 を 2 で割って 3", "あいう", 3],
        ["全角と英字の混在は 3 を切り上げて 2", "あa", 2],
        ["絵文字は全角 2 として 1", "😀", 1],
        ["URL も全文字を数え、12 字は 6", "https://e.co", 6],
    ])("%s", (_name, text, expected) => {
        expect(countTaittsuuLength(text)).toBe(expected)
    })
})
