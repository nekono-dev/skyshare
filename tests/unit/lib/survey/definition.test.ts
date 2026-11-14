/**
 * アンケート設定の形式と、不要なアンケート単位の文言の拒否を検証する。
 */
import { describe, expect, it } from "vitest"
import { parseSurveyConfig } from "@/lib/survey/definition"

const survey = {
    id: "survey-definition-test",
    opensAt: "2026-11-01T00:00:00Z",
    closesAt: "2026-12-01T00:00:00Z",
    questions: [
        {
            id: "question",
            kind: "single",
            title: { ja: "質問", en: "Question" },
            options: [
                { id: "yes", label: { ja: "はい", en: "Yes" } },
                { id: "no", label: { ja: "いいえ", en: "No" } },
            ],
        },
    ],
}

describe("parseSurveyConfig survey-level text fields", () => {
    it("accepts a survey without a survey-level title or description", () => {
        expect(parseSurveyConfig({ surveys: [survey] }).ok).toBe(true)
    })

    it.each([
        { title: { ja: "題", en: "Title" } },
        { description: { ja: "説明", en: "Description" } },
    ])("rejects survey-level text fields: %o", extra => {
        expect(
            parseSurveyConfig({ surveys: [{ ...survey, ...extra }] }).ok,
        ).toBe(false)
    })
})
