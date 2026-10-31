/**
 * 計量が例外になる入力での文字数の特性化テスト（src-duplicates 1.1・要件 1.1〜1.2）。
 * `twitter-text` の解析を失敗させ、現行の退避の値（X の換算は文字列長、共有の計量は文字列長の 2 倍）を固定する。
 */
import { describe, expect, it, vi } from "vitest"

vi.mock("twitter-text", () => ({
    default: {
        parseTweet: () => {
            throw new Error("計量の失敗（テスト用）")
        },
    },
}))

import { countWeightedTweetLength } from "@/util/textCount"
import { resolveIntentMeasure } from "@/util/share/intentLength"

describe("計量が例外になる場合の退避の値", () => {
    it("X の換算は文字列長をそのまま返す（2 で割った後の値が文字列長）", () => {
        expect(countWeightedTweetLength("abcd")).toBe(4)
    })

    it("X の計量は文字列長の 2 倍を返す", () => {
        expect(resolveIntentMeasure("x")("abcd")).toBe(8)
    })
})
