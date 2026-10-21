import { describe, expect, it } from "vitest"

import {
    INTENT_WEIGHTED_LIMIT,
    truncateBodyWithSuffix,
    weightedLength,
} from "@/util/share/truncateText"

const URL_TEXT = "https://skyshare.nekono.dev/entries/abc"

describe("weightedLength", () => {
    it("[share-text/AC-5] URLは長さに関わらず重み23、全角は2、半角は1、改行は1で数える", () => {
        expect(weightedLength(URL_TEXT)).toBe(23)
        expect(weightedLength(`\n${URL_TEXT}`)).toBe(24)
        expect(weightedLength("あ")).toBe(2)
        expect(weightedLength("a")).toBe(1)
    })
})

describe("truncateBodyWithSuffix", () => {
    it("[share-text/AC-9] 全体が上限以内なら加工しない", () => {
        const result = truncateBodyWithSuffix({
            body: "こんにちは",
            suffix: URL_TEXT,
            limit: INTENT_WEIGHTED_LIMIT,
        })
        expect(result).toEqual({
            text: `こんにちは\n${URL_TEXT}`,
            truncated: false,
        })
    })

    it("suffixが空でも、上限を超える場合は本文のみを「...」付きで省略する", () => {
        const result = truncateBodyWithSuffix({
            body: "あ".repeat(200),
            suffix: "",
            limit: INTENT_WEIGHTED_LIMIT,
        })
        expect(result.truncated).toBe(true)
        // 280 - 3（...）= 277 → 全角138文字（重み276）
        expect(result.text).toBe(`${"あ".repeat(138)}...`)
    })

    it("suffixが空で上限以内なら本文をそのまま返す", () => {
        expect(
            truncateBodyWithSuffix({
                body: "こんにちは",
                suffix: "",
                limit: INTENT_WEIGHTED_LIMIT,
            }),
        ).toEqual({ text: "こんにちは", truncated: false })
    })

    it("[share-text/AC-8] 上限を超える場合は本文のみを省略し「...」＋改行＋URLで終える", () => {
        const result = truncateBodyWithSuffix({
            body: "あ".repeat(200),
            suffix: URL_TEXT,
            limit: INTENT_WEIGHTED_LIMIT,
        })
        expect(result.truncated).toBe(true)
        expect(result.text.endsWith(`...\n${URL_TEXT}`)).toBe(true)
        expect(weightedLength(result.text)).toBeLessThanOrEqual(
            INTENT_WEIGHTED_LIMIT,
        )
        // 1文字多い本文では収まらない（最長の本文が選ばれている）
        const head = result.text.slice(0, result.text.indexOf("..."))
        const longer = `${head}あ...\n${URL_TEXT}`
        expect(weightedLength(longer)).toBeGreaterThan(INTENT_WEIGHTED_LIMIT)
    })

    it("全角140字ちょうどの本文＋URLは、URL分（改行込みで24）と「...」（3）を確保して省略される", () => {
        const result = truncateBodyWithSuffix({
            body: "あ".repeat(140),
            suffix: URL_TEXT,
            limit: INTENT_WEIGHTED_LIMIT,
        })
        // 280 - 24（URL23+改行1）- 3（...）= 253 → 全角126文字（重み252）
        expect(result.text).toBe(`${"あ".repeat(126)}...\n${URL_TEXT}`)
    })

    it("[share-text/AC-11] 絵文字などの結合文字を途中で分断しない", () => {
        const family = "👨‍👩‍👧‍👦"
        const result = truncateBodyWithSuffix({
            body: family.repeat(200),
            suffix: URL_TEXT,
            limit: INTENT_WEIGHTED_LIMIT,
        })
        expect(result.truncated).toBe(true)
        const head = result.text.slice(0, result.text.indexOf("..."))
        expect(head.length % family.length).toBe(0)
    })

    it("本文末尾の空白は「...」の前に残さない", () => {
        const result = truncateBodyWithSuffix({
            body: `${"あ".repeat(126)} ${"い".repeat(50)}`,
            suffix: URL_TEXT,
            limit: INTENT_WEIGHTED_LIMIT,
        })
        expect(result.text).toBe(`${"あ".repeat(126)}...\n${URL_TEXT}`)
    })

    it("[share-text/AC-10] URLだけで上限近く本文を1文字も残せない場合は省略しない", () => {
        const result = truncateBodyWithSuffix({
            body: "あいう",
            suffix: URL_TEXT,
            limit: 50,
        })
        expect(result).toEqual({
            text: `あいう\n${URL_TEXT}`,
            truncated: false,
        })
    })

    it("本文が空でsuffixのみの場合はsuffixをそのまま返す", () => {
        const result = truncateBodyWithSuffix({
            body: "",
            suffix: URL_TEXT,
            limit: INTENT_WEIGHTED_LIMIT,
        })
        expect(result).toEqual({ text: URL_TEXT, truncated: false })
    })
})
