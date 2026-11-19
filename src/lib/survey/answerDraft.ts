/** アンケートの選択状態の初期化・完了判定・送信回答への変換を行う。 */
import type { Survey } from "@/lib/survey/definition"

/** 質問IDから選択中の選択肢ID配列への写像。 */
export type SurveyDraft = Record<string, string[]>

/**
 * 各質問に独立した空配列を用意する。
 * Input: `survey`: 検証済みのアンケート定義。
 * Output: すべての質問IDに空配列を持つ選択状態。
 * 例: 質問IDがq1とq2なら `{ q1: [], q2: [] }`。
 */
export const emptyDraft = (survey: Survey): SurveyDraft => {
    return Object.fromEntries(
        survey.questions.map(question => [question.id, []]),
    )
}

/**
 * すべての質問で1件以上選ばれているか判定する。
 * Input: `survey`: 質問定義、`draft`: 質問IDをキーにした選択状態。
 * Output: 未選択の質問がなければtrue。
 * 例: 2問のうち1問だけが空ならfalse。
 */
export const isDraftComplete = (
    survey: Survey,
    draft: SurveyDraft,
): boolean => {
    return survey.questions.every(
        question => (draft[question.id]?.length ?? 0) > 0,
    )
}

/**
 * 完了済みの選択状態を送信する回答だけに変換する。
 * Input: `survey`: 質問定義、`draft`: 全質問に選択のある状態。
 * Output: 質問IDから単一の文字列または定義の選択肢順の配列への写像。
 * 例: single:[a]、multiple:[c,b]で定義がb,c順なら `{ single: "a", multiple: ["b", "c"] }`。
 */
export const toAnswers = (
    survey: Survey,
    draft: SurveyDraft,
): Record<string, string | string[]> => {
    return Object.fromEntries(
        survey.questions.map(question => [
            question.id,
            question.kind === "single"
                ? draft[question.id][0]
                : question.options
                      .map(option => option.id)
                      .filter(id => draft[question.id].includes(id)),
        ]),
    )
}
