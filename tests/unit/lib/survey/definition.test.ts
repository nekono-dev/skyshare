/**
 * アンケート設定の形式と不要な項目の拒否を検証する。
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

describe("option decline configuration", () => {
    it("rejects decline on an option", () => {
        const config = {
            ...survey,
            questions: [
                {
                    ...survey.questions[0],
                    options: [
                        { ...survey.questions[0].options[0], decline: true },
                        survey.questions[0].options[1],
                    ],
                },
            ],
        }
        expect(parseSurveyConfig({ surveys: [config] }).ok).toBe(false)
    })

    it("allows maxSelect up to all options and rejects a larger value", () => {
        const question = {
            id: "question",
            kind: "multiple",
            title: { ja: "質問", en: "Question" },
            options: [
                { id: "one", label: { ja: "一", en: "One" } },
                { id: "two", label: { ja: "二", en: "Two" } },
            ],
        }

        expect(
            parseSurveyConfig({
                surveys: [
                    { ...survey, questions: [{ ...question, maxSelect: 2 }] },
                ],
            }).ok,
        ).toBe(true)
        expect(
            parseSurveyConfig({
                surveys: [
                    { ...survey, questions: [{ ...question, maxSelect: 3 }] },
                ],
            }).ok,
        ).toBe(false)
    })
})
