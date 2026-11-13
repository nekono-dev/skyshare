/**
 * アンケート回答の JSON 行を検証し、質問・選択肢ごとの割合を集計する。
 */

import { checkAnswers } from "@/lib/survey/answers"
import type { Survey } from "@/lib/survey/definition"
import { SCHEMA_VERSION } from "@/lib/survey/results/schema"
import type { SurveyResult } from "@/lib/survey/results/schema"

/**
 * アンケート回答から選択肢ごとの割合を求める。
 *
 * Input:
 * - `survey`: 検証済みのアンケート設定
 * - `answerRows`: D1 の回答本文を格納した JSON 文字列の配列
 *
 * Output:
 * - 有効回答がある場合は結果。割合は百分率で小数点以下 1 桁
 * - 有効回答が 0 件の場合は `undefined`
 *
 * 例:
 * - 3 人中 1 人が選んだ選択肢 → `33.3`
 * - 3 人中 2 人が選んだ選択肢 → `66.7`
 */
export const tallySurvey = (
    survey: Survey,
    answerRows: string[],
): SurveyResult | undefined => {
    const validAnswers = answerRows.flatMap(row => {
        let parsed: unknown
        try {
            parsed = JSON.parse(row)
        } catch {
            return []
        }
        // オブジェクト以外（null・配列・数値など）は読めない行として除外する
        if (
            typeof parsed !== "object" ||
            parsed === null ||
            Array.isArray(parsed)
        )
            return []
        const checked = checkAnswers(
            survey,
            parsed as Record<string, string | string[]>,
        )
        return checked.ok ? [checked.answers] : []
    })

    if (validAnswers.length === 0) return undefined

    const denominator = validAnswers.length
    return {
        schemaVersion: SCHEMA_VERSION,
        id: survey.id,
        opensAt: survey.opensAt,
        closesAt: survey.closesAt,
        questions: survey.questions.map(question => ({
            id: question.id,
            kind: question.kind,
            title: question.title,
            options: question.options
                .filter(option => option.decline !== true)
                .map(option => {
                    const selected = validAnswers.reduce((count, answers) => {
                        const answer = answers[question.id]
                        return (
                            count +
                            (Array.isArray(answer)
                                ? Number(answer.includes(option.id))
                                : Number(answer === option.id))
                        )
                    }, 0)
                    const tenths = Math.floor(
                        (selected * 1000 + denominator / 2) / denominator,
                    )
                    return {
                        id: option.id,
                        label: option.label,
                        percent: tenths / 10,
                    }
                }),
        })),
    }
}
