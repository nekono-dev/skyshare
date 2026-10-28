/** アンケートの選択状態を純粋関数で補正し、完了・辞退の判定と送信回答への変換を行う。 */
import type { Survey, SurveyQuestion } from "@/lib/survey/definition"

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
 * 部品から受けた選択に「回答しない」の排他規則を適用する。
 * Input: `question`: 質問定義、`current`: 現在の選択、`next`: 部品の次の選択。
 * Output: 単一選択はnextのコピー。複数選択は新規の辞退を優先し、辞退から他の選択へ切り替える。
 * 例: currentが[a]、nextが[a, skip]でskipにdecline印があれば `[skip]`。
 */
export const changeSelection = (
    question: SurveyQuestion,
    current: readonly string[],
    next: readonly string[],
): string[] => {
    // 単一選択は部品へ委ね、複数選択だけ現在と次の辞退の有無で切り替え方向を判別する。
    if (question.kind === "single") return [...next]
    const decline = question.options.find(option => option.decline === true)
    if (!decline || !next.includes(decline.id)) return [...next]
    if (!current.includes(decline.id)) return [decline.id]
    return next.length > 1 ? next.filter(id => id !== decline.id) : [...next]
}

/**
 * すべての質問で1件以上選ばれているか判定する。
 * Input: `survey`: 質問定義、`draft`: 質問IDをキーにした選択状態。
 * Output: 未選択の質問がなければtrue。辞退も選択として数える。
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
 * いずれかの質問で設定のdecline印付き選択肢が選ばれているか判定する。
 * Input: `survey`: 質問と選択肢の定義、`draft`: 現在の選択状態。
 * Output: 辞退の選択が1件でもあればtrue。IDの文字列からは推測しない。
 * 例: IDがskipでもdecline印がなければfalse。
 */
export const draftHasDecline = (
    survey: Survey,
    draft: SurveyDraft,
): boolean => {
    return survey.questions.some(question =>
        question.options.some(
            option =>
                option.decline === true &&
                draft[question.id]?.includes(option.id),
        ),
    )
}

/**
 * 完了済みの選択状態を送信する回答だけに変換する。
 * Input: `survey`: 質問定義、`draft`: 全質問に選択のある状態。送信には辞退を含まない場合だけ使う。
 * Output: 質問IDから単一の文字列または定義の選択肢順の配列への写像。利用者ID・時刻は含めない。
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
                      .filter(option => draft[question.id].includes(option.id))
                      .map(option => option.id),
        ]),
    )
}
