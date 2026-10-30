/**
 * 実ブラウザ検証用の設定が、設定の契約と必要な質問構成を満たすことを保証する。
 * 実時刻での開催と全対応言語を検査し、期間切れや言語追加への追随漏れを検出する。
 */
import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

import { LOCALES } from "@/lib/i18n/locale"
import { parseSurveyConfig } from "@/lib/survey/definition"
import { currentSurvey } from "@/lib/survey/period"

/**
 * 保存された検証用 JSON を、実際の設定と同じ入口で検証する。
 * Input: なし（tests/fixtures/survey/e2e-open.json を読む）
 * Output: 検証済み設定。不正なら理由を付けて失敗する。
 * 例: 正しい設定 → surveys を持つ設定。
 */
const loadConfig = () => {
    const input: unknown = JSON.parse(
        readFileSync(
            new URL("../../fixtures/survey/e2e-open.json", import.meta.url),
            "utf8",
        ),
    )
    const result = parseSurveyConfig(input)
    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error(result.issues.join("\n"))
    return result.config
}

describe("実ブラウザ検証用のアンケート設定", () => {
    it("[7.2, 7.5] 設定の検証を通り、現在開催中の e2e-open が1件だけある", () => {
        const config = loadConfig()
        expect(config.surveys).toHaveLength(1)
        const survey = config.surveys[0]
        expect(survey.id).toBe("e2e-open")
        const now = new Date()
        expect(Date.parse(survey.opensAt)).toBeLessThan(now.getTime())
        expect(Date.parse(survey.closesAt)).toBeGreaterThanOrEqual(
            Date.parse("2100-01-01T00:00:00Z"),
        )
        expect(currentSurvey(config, now)).toBe(survey)
    })

    it("[7.2, 7.5] 単一選択と上限2の複数選択があり、両方に辞退の印がある", () => {
        const survey = loadConfig().surveys[0]
        expect(survey.questions).toHaveLength(2)
        expect(survey.questions.map(question => question.kind).sort()).toEqual([
            "multiple",
            "single",
        ])
        const multiple = survey.questions.find(
            question => question.kind === "multiple",
        )
        expect(multiple?.maxSelect).toBe(2)
        expect(
            multiple?.options.filter(option => option.decline !== true).length,
        ).toBeGreaterThan(2)
        for (const question of survey.questions) {
            expect(
                question.options.filter(option => option.decline === true),
            ).toHaveLength(1)
        }
    })

    it("[7.2, 7.5] タイトル・説明・質問・全選択肢の言語がLOCALESと完全一致する", () => {
        const survey = loadConfig().surveys[0]
        expect(survey.description).toBeDefined()
        const texts = [
            survey.title,
            survey.description!,
            ...survey.questions.flatMap(question => [
                question.title,
                ...question.options.map(option => option.label),
            ]),
        ]
        for (const text of texts) {
            expect(Object.keys(text).sort()).toEqual([...LOCALES].sort())
            for (const locale of LOCALES) {
                expect(text[locale].trim().length).toBeGreaterThan(0)
            }
        }
    })
})
