/**
 * アンケートの回答の検証・正規化・回答した日の算出（AnswerValidation）。
 *
 * 責務と処理概要:
 * - 端末から受け取った回答を、アンケートの設定と照合する（質問の過不足・選択肢の存在・個数・重複・上限）。
 * - 構造が妥当なうえで「回答しない」の選択肢を含むときだけ、未完了（declined）として区別する。
 *   構造の不正と重なるときは不正（invalid）を優先する。
 * - 保存用に、質問の順・選択肢の順（いずれも設定の順）へ並べ替える。選択の順番は残さない。
 * - 回答した日を日本標準時の暦で、日より細かい時刻を含めずに求める。
 * - 現在時刻は引数で受け取る。D1・セッション・atproto に依存しない純粋なモジュール。
 */

import type { Survey } from "@/lib/survey/definition"

/** 端末から受け取る回答（質問 ID → 選択肢 ID か配列） */
export type AnswerInput = Record<string, string | string[]>

/** 保存する回答。キーは質問の順、複数選択の配列は選択肢の順 */
export type NormalizedAnswers = Record<string, string | string[]>

export type AnswerCheck =
    | { ok: true; answers: NormalizedAnswers }
    | { ok: false; reason: "invalid" | "declined" }

/** 日本標準時の UTC からの差（ミリ秒） */
const JST_OFFSET_MS = 9 * 60 * 60 * 1000

/**
 * 回答を設定と照合し、保存用に正規化する。
 *
 * Input:
 * - `survey`: 検証済みの設定のアンケート
 * - `input`: 端末から受け取った回答（変更しない）
 *
 * Output:
 * - 妥当: `{ ok: true, answers }`（全質問を設定の順に含み、複数選択は選択肢の順）
 * - 不正: `{ ok: false, reason: "invalid" }`
 * - 妥当だが「回答しない」を含む: `{ ok: false, reason: "declined" }`
 *
 * 例:
 * - 単一 q1(a,b)・複数 q2(x,y,z, 上限 2) に `{ q2: ["z","x"], q1: "a" }`
 *   → `{ ok: true, answers: { q1: "a", q2: ["x","z"] } }`
 * - 質問が足りない → `{ ok: false, reason: "invalid" }`
 */
export const checkAnswers = (
    survey: Survey,
    input: AnswerInput,
): AnswerCheck => {
    const has = (key: string): boolean =>
        Object.prototype.hasOwnProperty.call(input, key)

    // 設定にない質問がある、または質問が不足している
    const inputKeys = Object.keys(input)
    if (
        inputKeys.length !== survey.questions.length ||
        survey.questions.some(question => !has(question.id))
    ) {
        return { ok: false, reason: "invalid" }
    }

    const answers: NormalizedAnswers = {}
    let declined = false

    for (const question of survey.questions) {
        const value = input[question.id]
        const optionIds = new Set(question.options.map(option => option.id))
        const declineIds = new Set(
            question.options
                .filter(option => option.decline === true)
                .map(option => option.id),
        )

        if (question.kind === "single") {
            if (typeof value !== "string" || !optionIds.has(value)) {
                return { ok: false, reason: "invalid" }
            }
            if (declineIds.has(value)) declined = true
            answers[question.id] = value
            continue
        }

        if (!Array.isArray(value) || value.length === 0) {
            return { ok: false, reason: "invalid" }
        }
        const selected = new Set<string>()
        for (const id of value) {
            if (typeof id !== "string" || !optionIds.has(id)) {
                return { ok: false, reason: "invalid" }
            }
            if (selected.has(id)) return { ok: false, reason: "invalid" }
            selected.add(id)
        }
        if (
            question.maxSelect !== undefined &&
            selected.size > question.maxSelect
        ) {
            return { ok: false, reason: "invalid" }
        }
        if (value.some(id => declineIds.has(id))) declined = true
        // 選択の順番を残さず、設定の選択肢の順に並べる
        answers[question.id] = question.options
            .map(option => option.id)
            .filter(id => selected.has(id))
    }

    if (declined) return { ok: false, reason: "declined" }
    return { ok: true, answers }
}

/**
 * 回答した日（日本標準時の暦）を YYYY-MM-DD で返す。
 *
 * Input:
 * - `now`: 回答した時刻
 *
 * Output:
 * - 日本標準時の日付。日より細かい時刻を含まない
 *
 * 例:
 * - `2026-11-01T14:59:59Z` → `"2026-11-01"`
 * - `2026-11-01T15:00:00Z` → `"2026-11-02"`
 */
export const answeredOn = (now: Date): string =>
    new Date(now.getTime() + JST_OFFSET_MS).toISOString().slice(0, 10)
