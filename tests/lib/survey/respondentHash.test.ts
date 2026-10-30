import { describe, expect, it } from "vitest"

import { respondentHash } from "@/lib/survey/respondentHash"

// バイト 0..31 を Base64 にした 32 バイトの鍵
const KEY = "AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8="
const OTHER_KEY = "HyAhIiMkJSYnKCkqKywtLi8wMTIzNDU2Nzg5Ojs8PT4="
const SURVEY = "survey-2026-11"
const DID = "did:plc:abcdefghijklmnopqrstuvwx"

describe("respondentHash", () => {
    it("[survey-api/6.6] 既知の入力に対して固定の 64 文字の 16 進を返す", async () => {
        // Node の crypto による独立計算の値
        expect(await respondentHash(KEY, SURVEY, DID)).toBe(
            "f15d5ea305c23b03271a1e7313881e15a1f48443aac54d714dce510d884f51ab",
        )
    })

    it("[survey-api/6.4] 同じ入力では常に同じ値になる", async () => {
        const a = await respondentHash(KEY, SURVEY, DID)
        const b = await respondentHash(KEY, SURVEY, DID)
        expect(a).toBe(b)
        expect(a).toMatch(/^[0-9a-f]{64}$/)
    })

    it("[survey-api/7.4] 別の did では別の値になる", async () => {
        const a = await respondentHash(KEY, SURVEY, DID)
        const b = await respondentHash(
            KEY,
            SURVEY,
            "did:plc:zzzzzzzzzzzzzzzzzzzzzzzz",
        )
        expect(a).not.toBe(b)
    })

    it("[survey-api/6.4] 別のアンケートでは別の値になる", async () => {
        const a = await respondentHash(KEY, SURVEY, DID)
        const b = await respondentHash(KEY, "survey-2026-12", DID)
        expect(a).not.toBe(b)
    })

    it("[survey-api/6.6] 別の鍵では別の値になる", async () => {
        const a = await respondentHash(KEY, SURVEY, DID)
        const b = await respondentHash(OTHER_KEY, SURVEY, DID)
        expect(a).not.toBe(b)
    })

    it("[survey-api/9.4] Base64 でない鍵は、値を含まない固定の例外になる", async () => {
        const bad = "!!!not-base64!!!"
        const err = await respondentHash(bad, SURVEY, DID).catch(
            (e: unknown) => e,
        )
        expect(err).toBeInstanceOf(Error)
        const msg = (err as Error).message
        expect(msg).toBe("invalid respondent hash key")
        expect(msg).not.toContain(bad)
        expect(msg).not.toContain(DID)
    })

    it("[survey-api/9.4] 長さが 32 バイトでない鍵は同じ固定の例外になる", async () => {
        const short = btoa("short-key")
        await expect(respondentHash(short, SURVEY, DID)).rejects.toThrow(
            "invalid respondent hash key",
        )
        await expect(respondentHash("", SURVEY, DID)).rejects.toThrow(
            "invalid respondent hash key",
        )
    })
})
