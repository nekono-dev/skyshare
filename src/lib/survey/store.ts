/**
 * ログイン時アンケートの保管（回答済みの集合と匿名の回答の 2 表）。
 *
 * 責務と処理概要:
 * - D1 に触れる唯一の部品。引数にも戻り値にも、回答者の識別子は did_hash 以外を現さない。
 * - 確認は主キーでの読み取り 1 回、登録は重複を無視する書き込み 1 回。
 * - 回答の保存は「集合への通常の INSERT → 回答の INSERT」を `batch` の 1 回で送る。
 *   集合の主キー違反でバッチ全体が取り消され、事前の SELECT は行わない。
 * - 一意性違反のうち survey_respondents のものだけを重複として返し、ほかの失敗は投げる。
 * - 削除はアンケートごとに表別で、削除した行数を返す。SQL は常にバインド変数を使う。
 */

import type { D1Database } from "@/lib/schedule/cfTypes"

/** 保存の結果 */
export type SaveAnswerResult = "saved" | "duplicate"

/**
 * 集合の主キー違反を示すメッセージの断片。
 * workerd 上の D1 の batch() が投げる実測の文言は
 * "D1_ERROR: UNIQUE constraint failed: survey_respondents.survey_id, survey_respondents.did_hash: SQLITE_CONSTRAINT (extended: SQLITE_CONSTRAINT_PRIMARYKEY)"。
 * 接頭辞と末尾の違いを許すため、部分一致で判定する。
 */
const RESPONDENT_UNIQUE_MESSAGE = "UNIQUE constraint failed: survey_respondents"

/**
 * 例外が回答済みの集合の一意性違反かを判定する。
 *
 * Input: 捕捉した例外
 * Output: メッセージに集合の一意性違反を含むなら true
 * 例: Error("D1_ERROR: UNIQUE constraint failed: survey_respondents.survey_id") → true
 */
const isRespondentDuplicate = (error: unknown): boolean => {
    return (
        error instanceof Error &&
        error.message.includes(RESPONDENT_UNIQUE_MESSAGE)
    )
}

/**
 * 回答済みかを主キーでの 1 回の読み取りで確認する。
 *
 * Input: D1、アンケートの識別子、回答者の一方向の値
 * Output: 集合に存在すれば true
 * 例: isRespondent(db, "s1", "h1") → false
 */
export const isRespondent = async (
    db: D1Database,
    surveyId: string,
    didHash: string,
): Promise<boolean> => {
    const row = await db
        .prepare(
            "SELECT 1 AS found FROM survey_respondents WHERE survey_id = ? AND did_hash = ?",
        )
        .bind(surveyId, didHash)
        .first<{ found: number }>()
    return row !== null
}

/**
 * 回答済みとして登録する。重複は無視し、繰り返しても結果は変わらない。
 *
 * Input: D1、アンケートの識別子、回答者の一方向の値
 * Output: なし
 * 例: registerRespondent(db, "s1", "h1")
 */
export const registerRespondent = async (
    db: D1Database,
    surveyId: string,
    didHash: string,
): Promise<void> => {
    await db
        .prepare(
            "INSERT OR IGNORE INTO survey_respondents (survey_id, did_hash) VALUES (?, ?)",
        )
        .bind(surveyId, didHash)
        .run()
}

/**
 * 回答を保存する。集合と回答の挿入を 1 回の原子的な呼び出しで行う。
 *
 * Input: D1、アンケート・回答者の値・回答の識別子・回答の JSON・回答日
 * Output: "saved"（両表に入った）／"duplicate"（集合の一意性違反。回答は残らない）
 * 例: 2 回目の同じ (surveyId, didHash) → "duplicate"。それ以外の失敗は例外のまま投げる
 */
export const saveAnswer = async (
    db: D1Database,
    input: {
        surveyId: string
        didHash: string
        answerId: string
        answersJson: string
        answeredOn: string
    },
): Promise<SaveAnswerResult> => {
    try {
        await db.batch([
            db
                .prepare(
                    "INSERT INTO survey_respondents (survey_id, did_hash) VALUES (?, ?)",
                )
                .bind(input.surveyId, input.didHash),
            db
                .prepare(
                    "INSERT INTO survey_answers (survey_id, id, answers, answered_on) VALUES (?, ?, ?, ?)",
                )
                .bind(
                    input.surveyId,
                    input.answerId,
                    input.answersJson,
                    input.answeredOn,
                ),
        ])
        return "saved"
    } catch (error) {
        if (isRespondentDuplicate(error)) {
            return "duplicate"
        }
        throw error
    }
}

/**
 * 指定のアンケートの回答済みの集合を削除する。
 *
 * Input: D1、アンケートの識別子
 * Output: 削除した行数（削除済みなら 0）
 * 例: purgeRespondents(db, "s1") → 2
 */
export const purgeRespondents = async (
    db: D1Database,
    surveyId: string,
): Promise<number> => {
    const result = await db
        .prepare("DELETE FROM survey_respondents WHERE survey_id = ?")
        .bind(surveyId)
        .run()
    return result.meta?.changes ?? 0
}

/**
 * 指定のアンケートの回答を削除する。
 *
 * Input: D1、アンケートの識別子
 * Output: 削除した行数（削除済みなら 0）
 * 例: purgeAnswers(db, "s1") → 2
 */
export const purgeAnswers = async (
    db: D1Database,
    surveyId: string,
): Promise<number> => {
    const result = await db
        .prepare("DELETE FROM survey_answers WHERE survey_id = ?")
        .bind(surveyId)
        .run()
    return result.meta?.changes ?? 0
}
