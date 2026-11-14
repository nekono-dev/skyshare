/**
 * ログイン時アンケートの回答済み集合と匿名回答を D1 に保管する。
 *
 * - 回答者識別子として扱うのは `did_hash` のみ。回答保存は集合 INSERT → 回答 INSERT を `batch` 1 回で行い、主キー違反時は全体が取り消されるため事前 SELECT はしない。
 * - 集合の一意性違反だけを `duplicate` とし、他の失敗は投げる。SQL はバインド変数を使う。
 */

import type { D1Database, D1Statement } from "@/lib/platform/cfTypes"

type AnswerRow = { survey_id: string; answers: string }
type SurveyIdRow = { survey_id: string }

/** D1 の 1 文あたりのバインド変数は 100 個まで。 */
const IDS_PER_STATEMENT = 100
/** 残存確認は各 ID を 2 回使うため、1 文 50 件まで。 */
const RESIDUAL_IDS_PER_STATEMENT = 50

/** 識別子を SQL 文の上限に合わせて分割する。 */
const chunkIds = (ids: string[], size: number): string[][] => {
    const chunks: string[][] = []
    for (let index = 0; index < ids.length; index += size) {
        chunks.push(ids.slice(index, index + size))
    }
    return chunks
}

/**
 * 複数アンケートの回答本文と残存識別子を batch で読む。
 *
 * Input: D1、回答本文を読む識別子と残存を調べる識別子
 * Output: 識別子ごとの回答本文（該当なしは空配列）と残存識別子の集合
 * 例: readDailyRows(db, { answerSurveyIds: ["s1"], residualSurveyIds: [] })
 */
export const readDailyRows = async (
    db: D1Database,
    query: { answerSurveyIds: string[]; residualSurveyIds: string[] },
): Promise<{ answers: Map<string, string[]>; residual: Set<string> }> => {
    const answers = new Map(
        query.answerSurveyIds.map(id => [id, [] as string[]]),
    )
    const residual = new Set<string>()
    if (
        query.answerSurveyIds.length === 0 &&
        query.residualSurveyIds.length === 0
    ) {
        return { answers, residual }
    }

    const statements: D1Statement[] = []
    const answerChunks = chunkIds(query.answerSurveyIds, IDS_PER_STATEMENT)
    for (const ids of answerChunks) {
        const placeholders = ids.map(() => "?").join(", ")
        statements.push(
            db
                .prepare(
                    `SELECT survey_id, answers FROM survey_answers WHERE survey_id IN (${placeholders})`,
                )
                .bind(...ids),
        )
    }
    const residualChunks = chunkIds(
        query.residualSurveyIds,
        RESIDUAL_IDS_PER_STATEMENT,
    )
    for (const ids of residualChunks) {
        const placeholders = ids.map(() => "?").join(", ")
        statements.push(
            db
                .prepare(
                    `SELECT survey_id FROM survey_answers WHERE survey_id IN (${placeholders}) UNION SELECT survey_id FROM survey_respondents WHERE survey_id IN (${placeholders})`,
                )
                .bind(...ids, ...ids),
        )
    }
    const results = await db.batch(statements)
    let resultIndex = 0
    for (const _ids of answerChunks) {
        for (const row of (results[resultIndex++]?.results ??
            []) as AnswerRow[]) {
            answers.get(row.survey_id)?.push(row.answers)
        }
    }
    for (const _ids of residualChunks) {
        for (const row of (results[resultIndex++]?.results ??
            []) as SurveyIdRow[]) {
            residual.add(row.survey_id)
        }
    }
    return { answers, residual }
}

/**
 * 複数アンケートの回答済み集合を batch で削除する。
 *
 * Input: D1、アンケート識別子の配列
 * Output: なし。失敗はそのまま呼び出し元へ返す
 * 例: purgeRespondentsBatch(db, ["s1", "s2"])
 */
export const purgeRespondentsBatch = async (
    db: D1Database,
    surveyIds: string[],
): Promise<void> => {
    if (surveyIds.length === 0) return
    const statements = chunkIds(surveyIds, IDS_PER_STATEMENT).map(ids => {
        const placeholders = ids.map(() => "?").join(", ")
        return db
            .prepare(
                `DELETE FROM survey_respondents WHERE survey_id IN (${placeholders})`,
            )
            .bind(...ids)
    })
    await db.batch(statements)
}

/**
 * 複数アンケートの回答と回答済み集合を同じ batch で削除する。
 *
 * Input: D1、アンケート識別子の配列
 * Output: なし。失敗はそのまま呼び出し元へ返す
 * 例: purgeSurveysBatch(db, ["s1", "s2"])
 */
export const purgeSurveysBatch = async (
    db: D1Database,
    surveyIds: string[],
): Promise<void> => {
    if (surveyIds.length === 0) return
    const answersStatements = chunkIds(surveyIds, IDS_PER_STATEMENT).map(
        ids => {
            const placeholders = ids.map(() => "?").join(", ")
            return db
                .prepare(
                    `DELETE FROM survey_answers WHERE survey_id IN (${placeholders})`,
                )
                .bind(...ids)
        },
    )
    const respondentStatements = chunkIds(surveyIds, IDS_PER_STATEMENT).map(
        ids => {
            const placeholders = ids.map(() => "?").join(", ")
            return db
                .prepare(
                    `DELETE FROM survey_respondents WHERE survey_id IN (${placeholders})`,
                )
                .bind(...ids)
        },
    )
    await db.batch([...answersStatements, ...respondentStatements])
}

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
