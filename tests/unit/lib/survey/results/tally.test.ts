/**
 * アンケート回答の集計結果と除外・丸めの規則を確かめる。
 */

import { describe, expect, it } from "vitest"

import { tallySurvey } from "@/lib/survey/results/tally"
import { parseSurveyResult } from "@/lib/survey/results/schema"
import type { Survey } from "@/lib/survey/definition"

const survey: Survey = {
    id: "3f2b9c1e-7a54-4d1e-9b0c-5a6d2e8f4c10",
    opensAt: "2026-11-01T00:00:00+09:00",
    closesAt: "2026-12-01T00:00:00+09:00",
    title: { ja: "全体の題", en: "Survey title" },
    description: { ja: "説明", en: "Description" },
    questions: [
        {
            id: "single",
            kind: "single",
            title: { ja: "単一選択", en: "Single" },
            options: [
                { id: "a", label: { ja: "A", en: "A" } },
                { id: "b", label: { ja: "B", en: "B" } },
                {
                    id: "decline",
                    label: { ja: "回答しない", en: "Decline" },
                    decline: true,
                },
            ],
        },
        {
            id: "multiple",
            kind: "multiple",
            title: { ja: "複数選択", en: "Multiple" },
            options: [
                { id: "x", label: { ja: "X", en: "X" } },
                { id: "y", label: { ja: "Y", en: "Y" } },
                { id: "z", label: { ja: "Z", en: "Z" } },
                { id: "w", label: { ja: "W", en: "W" } },
                { id: "v", label: { ja: "V", en: "V" } },
            ],
        },
    ],
}

const row = (single: string, multiple: string[]): string =>
    JSON.stringify({ single, multiple })

describe("tallySurvey", () => {
    it("computes each option against valid respondents and validates the result", () => {
        const result = tallySurvey(survey, [
            row("a", ["x", "y"]),
            row("b", ["x", "z"]),
            row("b", ["y", "z"]),
        ])

        expect(result).toBeDefined()
        expect(parseSurveyResult(result)).toMatchObject({ ok: true })
        expect(
            result?.questions[0].options.map(option => option.percent),
        ).toEqual([33.3, 66.7])
        expect(
            result?.questions[1].options.map(option => option.percent),
        ).toEqual([66.7, 66.7, 66.7, 0, 0])
        expect(
            result?.questions[1].options.reduce(
                (sum, option) => sum + option.percent,
                0,
            ),
        ).toBeGreaterThan(100)
    })

    it("excludes invalid, mismatched, and declined rows from numerator and denominator", () => {
        const result = tallySurvey(survey, [
            row("a", ["x"]),
            "{invalid",
            JSON.stringify({ single: "unknown", multiple: ["x"] }),
            row("decline", ["y"]),
        ])

        expect(result?.questions[0].options[0].percent).toBe(100)
        expect(result?.questions[1].options[0].percent).toBe(100)
        expect(result?.questions[0].options).toHaveLength(2)
    })

    it("excludes rows whose JSON is not an object without throwing", () => {
        const result = tallySurvey(survey, [
            "null",
            "[]",
            "5",
            '"text"',
            "true",
            row("a", ["x"]),
        ])

        expect(result?.questions[0].options[0].percent).toBe(100)
    })

    it("returns undefined when no valid respondents exist", () => {
        expect(tallySurvey(survey, [])).toBeUndefined()
        expect(
            tallySurvey(survey, ["no json", row("decline", ["x"])]),
        ).toBeUndefined()
    })

    it("rounds half up to one decimal without floating point artifacts", () => {
        const roundingSurvey: Survey = {
            ...survey,
            questions: [
                {
                    id: "q",
                    kind: "single",
                    title: { ja: "質問", en: "Question" },
                    options: [
                        { id: "a", label: { ja: "A", en: "A" } },
                        { id: "b", label: { ja: "B", en: "B" } },
                    ],
                },
            ],
        }
        const rows = ["a", "a", "a", "a", "a", "a", "a", "b"].map(value =>
            JSON.stringify({ q: value }),
        )
        expect(
            tallySurvey(roundingSurvey, rows)?.questions[0].options.map(
                option => option.percent,
            ),
        ).toEqual([87.5, 12.5])
    })

    it.each([
        { counts: [1, 15], expected: [6.3, 93.8] },
        { counts: [5, 11], expected: [31.3, 68.8] },
        { counts: [1, 5], expected: [16.7, 83.3] },
        { counts: [1, 2], expected: [33.3, 66.7] },
    ])(
        "rounds exact ties up and other values to nearest for $counts",
        ({ counts, expected }) => {
            const roundingSurvey: Survey = {
                ...survey,
                questions: [
                    {
                        id: "q",
                        kind: "single",
                        title: { ja: "質問", en: "Question" },
                        options: [
                            { id: "a", label: { ja: "A", en: "A" } },
                            { id: "b", label: { ja: "B", en: "B" } },
                        ],
                    },
                ],
            }
            const rows = [
                ...Array<string>(counts[0]).fill("a"),
                ...Array<string>(counts[1]).fill("b"),
            ].map(value => JSON.stringify({ q: value }))

            const result = tallySurvey(roundingSurvey, rows)

            expect(result?.questions[0].options.map(o => o.percent)).toEqual(
                expected,
            )
            expect(parseSurveyResult(result).ok).toBe(true)
        },
    )

    it("copies question and option text without survey-level text or respondent counts, and does not mutate inputs", () => {
        const rows = [row("a", ["x"])]
        const surveyBefore = structuredClone(survey)
        const rowsBefore = [...rows]
        const result = tallySurvey(survey, rows)

        expect(result?.questions[0].title).toEqual(survey.questions[0].title)
        expect(result?.questions[0].options[0].label).toEqual(
            survey.questions[0].options[0].label,
        )
        expect(result).not.toHaveProperty("title")
        expect(result).not.toHaveProperty("description")
        expect(result).not.toHaveProperty("respondents")
        expect(survey).toEqual(surveyBefore)
        expect(rows).toEqual(rowsBefore)
    })
})
