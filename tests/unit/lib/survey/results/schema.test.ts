/**
 * 統計ファイルの形式と読み手の判定規則を検証する。
 */

import { describe, expect, it } from "vitest"
import {
    INDEX_KEY,
    SCHEMA_VERSION,
    isVisible,
    parseSurveyIndex,
    parseSurveyResult,
    parseSurveyVisibility,
    resultKey,
    resultMatchesIndexEntry,
    visibilityKey,
} from "@/lib/survey/results/schema"
import type { SurveyResult } from "@/lib/survey/results/schema"

const result: SurveyResult = {
    schemaVersion: 1,
    id: "3f2b9c1e-7a54-4d1e-9b0c-5a6d2e8f4c10",
    opensAt: "2026-11-01T00:00:00+09:00",
    closesAt: "2026-12-01T00:00:00+09:00",
    questions: [
        {
            id: "q-ui",
            kind: "single",
            title: { ja: "質問", en: "Question" },
            options: [
                {
                    id: "v1",
                    label: { ja: "はい", en: "Yes" },
                    percent: 42.9,
                },
            ],
        },
    ],
}

const indexEntry = {
    id: result.id,
    opensAt: result.opensAt,
    closesAt: result.closesAt,
    outcome: "result" as const,
}

const index = {
    schemaVersion: 1,
    surveys: [indexEntry],
}

describe("survey result schemas", () => {
    it("exposes the designed R2 keys and version", () => {
        expect(SCHEMA_VERSION).toBe(1)
        expect(INDEX_KEY).toBe("index.json")
        expect(resultKey(result.id)).toBe(`surveys/${result.id}.json`)
        expect(visibilityKey(result.id)).toBe(`visibility/${result.id}.json`)
    })

    it("accepts valid result, index, and visibility records", () => {
        expect(parseSurveyResult(result)).toEqual({ ok: true, value: result })
        expect(parseSurveyIndex(index)).toEqual({ ok: true, value: index })
        expect(
            parseSurveyVisibility({ schemaVersion: 1, visible: true }),
        ).toEqual({
            ok: true,
            value: { schemaVersion: 1, visible: true },
        })
    })

    it("rejects unknown fields, versions, invalid percentages, and duplicate ids", () => {
        const failure = { ok: false }
        expect(parseSurveyResult({ ...result, respondents: 3 })).toEqual(
            failure,
        )
        expect(
            parseSurveyResult({ ...result, title: { ja: "題", en: "Title" } }),
        ).toEqual(failure)
        expect(parseSurveyResult({ ...result, schemaVersion: 2 })).toEqual(
            failure,
        )
        expect(
            parseSurveyResult({
                ...result,
                questions: [
                    {
                        ...result.questions[0],
                        options: [
                            {
                                ...result.questions[0].options[0],
                                percent: 100.1,
                            },
                        ],
                    },
                ],
            }),
        ).toEqual(failure)
        expect(
            parseSurveyResult({
                ...result,
                questions: [
                    {
                        ...result.questions[0],
                        options: [
                            {
                                ...result.questions[0].options[0],
                                percent: 12.34,
                            },
                        ],
                    },
                ],
            }),
        ).toEqual(failure)
        expect(
            parseSurveyIndex({
                ...index,
                surveys: [...index.surveys, ...index.surveys],
            }),
        ).toEqual(failure)
        expect(parseSurveyIndex({ ...index, count: 1 })).toEqual(failure)
        expect(
            parseSurveyVisibility({
                schemaVersion: 1,
                visible: true,
                title: "x",
            }),
        ).toEqual(failure)
        expect(
            parseSurveyVisibility({ schemaVersion: 9, visible: true }),
        ).toEqual(failure)
    })

    it("rejects a duplicate question id while accepting the baseline", () => {
        const baseline = result
        expect(parseSurveyResult(baseline)).toEqual({
            ok: true,
            value: baseline,
        })
        expect(
            parseSurveyResult({
                ...baseline,
                questions: [
                    ...baseline.questions,
                    { ...baseline.questions[0] },
                ],
            }),
        ).toEqual({ ok: false })
    })

    it("rejects a duplicate option id while accepting the baseline", () => {
        const baseline = result
        const question = baseline.questions[0]
        expect(parseSurveyResult(baseline)).toEqual({
            ok: true,
            value: baseline,
        })
        expect(
            parseSurveyResult({
                ...baseline,
                questions: [
                    {
                        ...question,
                        options: [
                            ...question.options,
                            { ...question.options[0] },
                        ],
                    },
                ],
            }),
        ).toEqual({ ok: false })
    })

    it.each([-0.1, 100.1, 12.34])("rejects percent %s", percent => {
        const option = result.questions[0].options[0]
        expect(parseSurveyResult(result)).toEqual({ ok: true, value: result })
        expect(
            parseSurveyResult({
                ...result,
                questions: [
                    {
                        ...result.questions[0],
                        options: [{ ...option, percent }],
                    },
                ],
            }),
        ).toEqual({ ok: false })
    })

    it.each([0, 100, 33.3])("accepts boundary percentage %s", percent => {
        const changed = {
            ...result,
            questions: [
                {
                    ...result.questions[0],
                    options: [{ ...result.questions[0].options[0], percent }],
                },
            ],
        }
        expect(parseSurveyResult(changed)).toEqual({ ok: true, value: changed })
    })

    it("rejects an unknown index schema version", () => {
        expect(parseSurveyIndex(index)).toEqual({ ok: true, value: index })
        expect(parseSurveyIndex({ ...index, schemaVersion: 2 })).toEqual({
            ok: false,
        })
    })

    it("rejects unknown fields inside question and option objects", () => {
        expect(parseSurveyResult(result)).toEqual({ ok: true, value: result })
        const question = result.questions[0]
        expect(
            parseSurveyResult({
                ...result,
                questions: [{ ...question, extra: true }],
            }),
        ).toEqual({ ok: false })
        expect(
            parseSurveyResult({
                ...result,
                questions: [
                    {
                        ...question,
                        options: [{ ...question.options[0], extra: true }],
                    },
                ],
            }),
        ).toEqual({ ok: false })
    })

    it("does not expose supplied content in failure outcomes", () => {
        const secret = "private answer text"
        const parsed = parseSurveyResult({ ...result, secret })
        expect(parsed).toEqual({ ok: false })
        expect(JSON.stringify(parsed)).not.toContain(secret)
    })

    it("matches result identity and period against an index entry", () => {
        const entry = index.surveys[0]
        expect(resultMatchesIndexEntry(entry, result)).toBe(true)
        expect(resultMatchesIndexEntry({ ...entry, id: "other" }, result)).toBe(
            false,
        )
        expect(
            resultMatchesIndexEntry({ ...entry, opensAt: "other" }, result),
        ).toBe(false)
        expect(
            resultMatchesIndexEntry({ ...entry, closesAt: "other" }, result),
        ).toBe(false)
    })

    it("shows only an explicitly visible valid flag", () => {
        expect(isVisible(undefined)).toBe(false)
        expect(isVisible({ schemaVersion: 1, visible: true })).toBe(true)
        expect(isVisible({ schemaVersion: 1, visible: false })).toBe(false)
        expect(isVisible({ schemaVersion: 1, visible: 1 } as never)).toBe(false)
    })
})
