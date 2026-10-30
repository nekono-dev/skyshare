import { describe, expect, it } from "vitest"

import { answeredOn, checkAnswers } from "@/lib/survey/answers"
import type { Survey } from "@/lib/survey/definition"

const t = (s: string) => ({ ja: s, en: s })

const survey: Survey = {
    id: "s1",
    opensAt: "2026-11-01T00:00:00+09:00",
    closesAt: "2026-12-01T00:00:00+09:00",
    title: t("題"),
    questions: [
        {
            id: "q1",
            kind: "single",
            title: t("q1"),
            options: [
                { id: "a", label: t("a") },
                { id: "b", label: t("b") },
                { id: "none", label: t("none"), decline: true },
            ],
        },
        {
            id: "q2",
            kind: "multiple",
            title: t("q2"),
            maxSelect: 2,
            options: [
                { id: "x", label: t("x") },
                { id: "y", label: t("y") },
                { id: "z", label: t("z") },
                { id: "skip", label: t("skip"), decline: true },
            ],
        },
    ],
}

const invalid = { ok: false, reason: "invalid" }

describe("checkAnswers", () => {
    it("[survey-api/5.2] 妥当な回答が質問の順・選択肢の順に正規化される", () => {
        const input = { q2: ["z", "x"], q1: "a" }
        const result = checkAnswers(survey, input)
        expect(result).toEqual({
            ok: true,
            answers: { q1: "a", q2: ["x", "z"] },
        })
        if (result.ok) {
            expect(Object.keys(result.answers)).toEqual(["q1", "q2"])
            expect(JSON.stringify(result.answers)).toBe(
                '{"q1":"a","q2":["x","z"]}',
            )
        }
        // 入力を変更しない
        expect(input).toEqual({ q2: ["z", "x"], q1: "a" })
        expect(Object.keys(input)).toEqual(["q2", "q1"])
    })

    it("[survey-api/5.2] 質問が不足していると invalid", () => {
        expect(checkAnswers(survey, { q1: "a" })).toEqual(invalid)
        expect(checkAnswers(survey, {})).toEqual(invalid)
    })

    it("[survey-api/5.3] 設定にない質問を含むと invalid", () => {
        expect(checkAnswers(survey, { q1: "a", q2: ["x"], q3: "a" })).toEqual(
            invalid,
        )
        // 質問数が同じでも、別の質問に置き換わっていれば invalid
        expect(checkAnswers(survey, { q1: "a", q9: ["x"] })).toEqual(invalid)
        expect(
            checkAnswers(survey, { q1: "a", q2: ["x"], toString: "a" }),
        ).toEqual(invalid)
    })

    it("[survey-api/5.4] 単一選択は 1 つの文字列だけが妥当", () => {
        expect(checkAnswers(survey, { q1: ["a", "b"], q2: ["x"] })).toEqual(
            invalid,
        )
        expect(checkAnswers(survey, { q1: [], q2: ["x"] })).toEqual(invalid)
        expect(checkAnswers(survey, { q1: "", q2: ["x"] })).toEqual(invalid)
    })

    it("[survey-api/5.5] 複数選択の空・重複・上限超え・配列でない値は invalid", () => {
        expect(checkAnswers(survey, { q1: "a", q2: [] })).toEqual(invalid)
        expect(checkAnswers(survey, { q1: "a", q2: ["x", "x"] })).toEqual(
            invalid,
        )
        expect(checkAnswers(survey, { q1: "a", q2: ["x", "y", "z"] })).toEqual(
            invalid,
        )
        expect(checkAnswers(survey, { q1: "a", q2: "x" })).toEqual(invalid)
    })

    it("[survey-api/5.5] 上限ちょうどは妥当で、maxSelect なしは上限なし", () => {
        expect(checkAnswers(survey, { q1: "a", q2: ["y", "x"] }).ok).toBe(true)
        const noMax: Survey = {
            ...survey,
            questions: [
                {
                    id: "m",
                    kind: "multiple",
                    title: t("m"),
                    options: [
                        { id: "x", label: t("x") },
                        { id: "y", label: t("y") },
                        { id: "z", label: t("z") },
                    ],
                },
            ],
        }
        expect(checkAnswers(noMax, { m: ["z", "y", "x"] })).toEqual({
            ok: true,
            answers: { m: ["x", "y", "z"] },
        })
    })

    it("[survey-api/5.6] 設定にない選択肢は invalid", () => {
        expect(checkAnswers(survey, { q1: "c", q2: ["x"] })).toEqual(invalid)
        expect(checkAnswers(survey, { q1: "a", q2: ["x", "w"] })).toEqual(
            invalid,
        )
        // 別の質問の選択肢は使えない
        expect(checkAnswers(survey, { q1: "x", q2: ["x"] })).toEqual(invalid)
    })

    it("[survey-api/5.7] 妥当なうえで「回答しない」を含むと declined", () => {
        expect(checkAnswers(survey, { q1: "none", q2: ["x"] })).toEqual({
            ok: false,
            reason: "declined",
        })
        expect(checkAnswers(survey, { q1: "a", q2: ["x", "skip"] })).toEqual({
            ok: false,
            reason: "declined",
        })
    })

    it("[survey-api/5.7] 構造の不正と「回答しない」が重なると invalid を優先する", () => {
        expect(checkAnswers(survey, { q1: "none" })).toEqual(invalid)
        expect(checkAnswers(survey, { q1: "none", q2: ["x", "x"] })).toEqual(
            invalid,
        )
        expect(checkAnswers(survey, { q1: "none", q2: ["w"] })).toEqual(invalid)
        // 「回答しない」を含む複数選択が上限を超える場合も invalid
        expect(
            checkAnswers(survey, { q1: "a", q2: ["x", "y", "skip"] }),
        ).toEqual(invalid)
    })
})

describe("checkAnswers の追加の境界", () => {
    it("[survey-api/5.4] 単一選択に長さ 1 の配列を渡すと invalid", () => {
        expect(checkAnswers(survey, { q1: ["a"], q2: ["x"] })).toEqual(invalid)
    })

    it("[survey-api/5.2] 質問 ID が原型に存在しそうな名前でも、回答の有無を正しく判定する", () => {
        const proto: Survey = {
            ...survey,
            questions: [
                {
                    id: "constructor",
                    kind: "single",
                    title: t("c"),
                    options: [
                        { id: "a", label: t("a") },
                        { id: "b", label: t("b") },
                    ],
                },
            ],
        }
        // 欠落は invalid（原型の constructor を回答と誤認しない）
        expect(checkAnswers(proto, {})).toEqual(invalid)
        // ある場合は valid
        expect(checkAnswers(proto, { constructor: "a" })).toEqual({
            ok: true,
            answers: { constructor: "a" },
        })
    })
})

describe("answeredOn", () => {
    it("[survey-api/6.3] 日本時間の日付が変わる直前（UTC 14:59:59.999）は前の日", () => {
        expect(answeredOn(new Date("2026-11-01T14:59:59.999Z"))).toBe(
            "2026-11-01",
        )
    })

    it("[survey-api/6.3] 日本時間の日付が変わる時刻（UTC 15:00:00）で次の日になる", () => {
        expect(answeredOn(new Date("2026-11-01T15:00:00.000Z"))).toBe(
            "2026-11-02",
        )
    })

    it("[survey-api/6.3] 月末・年末をまたぐ", () => {
        expect(answeredOn(new Date("2026-12-31T15:00:00Z"))).toBe("2027-01-01")
        expect(answeredOn(new Date("2026-12-31T14:59:59Z"))).toBe("2026-12-31")
    })

    it("[survey-api/6.3] 日本時間の 0 時ちょうどと終日は同じ日で、日より細かい時刻を含まない", () => {
        expect(answeredOn(new Date("2026-11-02T00:00:00+09:00"))).toBe(
            "2026-11-02",
        )
        expect(answeredOn(new Date("2026-11-02T23:59:59.999+09:00"))).toBe(
            "2026-11-02",
        )
        expect(answeredOn(new Date("2026-11-02T12:34:56Z"))).toMatch(
            /^\d{4}-\d{2}-\d{2}$/,
        )
    })
})
