/**
 * アンケート期間の時刻判定を検証する。
 */
import { describe, expect, it } from "vitest"
import type { Survey } from "@/lib/survey/definition"
import { isClosed } from "@/lib/survey/period"

const survey = {
    id: "survey-period-test",
    opensAt: "2026-11-01T00:00:00Z",
    closesAt: "2026-12-01T00:00:00Z",
    title: { ja: "テスト", en: "Test" },
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
} satisfies Survey
const closesAt = Date.parse(survey.closesAt)

describe("isClosed", () => {
    it("returns false just before the closing time", () => {
        expect(isClosed(survey, new Date(closesAt - 1))).toBe(false)
    })

    it("returns true exactly at the closing time", () => {
        expect(isClosed(survey, new Date(closesAt))).toBe(true)
    })

    it("returns true just after the closing time", () => {
        expect(isClosed(survey, new Date(closesAt + 1))).toBe(true)
    })
})
