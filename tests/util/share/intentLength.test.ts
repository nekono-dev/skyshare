import { describe, expect, it } from "vitest"

import {
    resolveIntentMeasure,
    taittsuuIntentMeasure,
    xIntentMeasure,
} from "@/util/share/intentLength"
import { truncateBodyWithSuffix } from "@/util/share/truncateText"
import { countTaittsuuLength } from "@/util/textCount"

const URL_TEXT = "https://skyshare.nekono.dev/entries/did:plc:aaaa@bbbb/"

describe("taittsuuIntentMeasure", () => {
    it("全角=2、半角=1、改行=1で数える", () => {
        expect(taittsuuIntentMeasure("あ")).toBe(2)
        expect(taittsuuIntentMeasure("a")).toBe(1)
        expect(taittsuuIntentMeasure("\n")).toBe(1)
        expect(taittsuuIntentMeasure("ｱ")).toBe(1)
    })

    it("URLも例外とせず全文字を数える（Xの23固定にならない）", () => {
        expect(taittsuuIntentMeasure(URL_TEXT)).toBe(URL_TEXT.length)
        expect(xIntentMeasure(URL_TEXT)).toBe(23)
    })

    it("異体字セレクタ・ゼロ幅接合子は幅0、絵文字は全角", () => {
        expect(taittsuuIntentMeasure("‍️")).toBe(0)
        expect(taittsuuIntentMeasure("😀")).toBe(2)
    })
})

describe("countTaittsuuLength", () => {
    it("半角単位を2で割って切り上げる", () => {
        expect(countTaittsuuLength("あい")).toBe(2)
        expect(countTaittsuuLength("abc")).toBe(2)
    })
})

describe("resolveIntentMeasure", () => {
    it("宛先に対応する関数を返す", () => {
        expect(resolveIntentMeasure("x")).toBe(xIntentMeasure)
        expect(resolveIntentMeasure("taittsuu")).toBe(taittsuuIntentMeasure)
    })
})

describe("truncateBodyWithSuffix（タイッツー換算）", () => {
    it("URLを全文字で数えた上で上限以内に収める", () => {
        const result = truncateBodyWithSuffix({
            body: "あ".repeat(200),
            suffix: URL_TEXT,
            limit: 279,
            measure: taittsuuIntentMeasure,
        })
        expect(result.truncated).toBe(true)
        expect(taittsuuIntentMeasure(result.text)).toBeLessThanOrEqual(279)
        expect(result.text.endsWith(`...\n${URL_TEXT}`)).toBe(true)
    })
})
