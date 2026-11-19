/** アンケート回答の形式と選択肢を設定に照合する。 */
import { describe, expect, it } from "vitest"
import { checkAnswers } from "@/lib/survey/answers"
import type { Survey } from "@/lib/survey/definition"

const survey = {
    id: "survey-answer-test",
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
} satisfies Survey

describe("checkAnswers", () => {
    it("validates configured options as ordinary answers", () => {
        expect(checkAnswers(survey, { question: "yes" })).toEqual({
            ok: true,
            answers: { question: "yes" },
        })
    })

    it("returns only invalid for an unconfigured option", () => {
        expect(checkAnswers(survey, { question: "skip" })).toEqual({
            ok: false,
            reason: "invalid",
        })
    })
})
