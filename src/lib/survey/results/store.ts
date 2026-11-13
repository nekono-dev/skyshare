/**
 * 統計結果と目録を R2 に安全に保管する。
 */
import type { SurveyResultsBucket } from "@/lib/platform/cfTypes"
import {
    INDEX_KEY,
    parseSurveyIndex,
    parseSurveyResult,
    resultKey,
    resultMatchesIndexEntry,
    type SurveyIndex,
    type SurveyResult,
} from "@/lib/survey/results/schema"

/** 検証済み目録と、比較交換に使う R2 の etag。 */
export type IndexSnapshot = { index: SurveyIndex; etag: string | undefined }

/** 目録の読み取りまたは形式検証に失敗したことを示す。 */
export class IndexInvalidError extends Error {
    constructor() {
        super("Survey result index is invalid or unreadable")
        this.name = "IndexInvalidError"
    }
}

/** 目録の比較交換が 3 回の試行で成立しなかったことを示す。 */
export class IndexConflictError extends Error {
    constructor() {
        super("Survey result index update conflicted")
        this.name = "IndexConflictError"
    }
}

/** 結果本体の読み取りまたは形式検証に失敗したことを示す。 */
export class ResultInvalidError extends Error {
    constructor() {
        super("Survey result is invalid or unreadable")
        this.name = "ResultInvalidError"
    }
}

/** 結果本体が期待する識別子または期間と一致しないことを示す。 */
export class ResultMismatchError extends Error {
    constructor() {
        super("Survey result does not match the expected survey")
        this.name = "ResultMismatchError"
    }
}

const EMPTY_INDEX: SurveyIndex = { schemaVersion: 1, surveys: [] }

/**
 * 目録を読む。無ければ空の目録と etag なしを返し、検証や読み取りに失敗したら例外。
 *
 * Input: 結果保管用 R2 バケット
 * Output: 検証済み目録と、既存オブジェクトの etag
 * 例: readIndex(bucket) → { index, etag }
 */
export const readIndex = async (
    bucket: SurveyResultsBucket,
): Promise<IndexSnapshot> => {
    let object: Awaited<ReturnType<SurveyResultsBucket["get"]>>
    try {
        object = await bucket.get(INDEX_KEY)
    } catch {
        throw new IndexInvalidError()
    }
    if (object === null) return { index: EMPTY_INDEX, etag: undefined }

    let body: string
    try {
        body = await object.text()
    } catch {
        throw new IndexInvalidError()
    }
    let input: unknown
    try {
        input = JSON.parse(body)
    } catch {
        throw new IndexInvalidError()
    }
    const parsed = parseSurveyIndex(input)
    if (!parsed.ok) throw new IndexInvalidError()
    return { index: parsed.value, etag: object.etag }
}

const readStoredResult = async (
    bucket: SurveyResultsBucket,
    surveyId: string,
): Promise<SurveyResult | undefined> => {
    let object: Awaited<ReturnType<SurveyResultsBucket["get"]>>
    try {
        object = await bucket.get(resultKey(surveyId))
    } catch {
        throw new ResultInvalidError()
    }
    if (object === null) return undefined

    let input: unknown
    try {
        input = JSON.parse(await object.text())
    } catch {
        throw new ResultInvalidError()
    }
    const parsed = parseSurveyResult(input)
    if (!parsed.ok) throw new ResultInvalidError()
    return parsed.value
}

/**
 * 結果本体を読み、JSON・形式・要求した識別子を検証する。
 *
 * Input: 結果保管用 R2 バケット、要求するアンケート識別子
 * Output: 検証済み結果、または未保存なら undefined
 * 例: readResult(bucket, "survey-id") → undefined
 */
export const readResult = async (
    bucket: SurveyResultsBucket,
    surveyId: string,
): Promise<SurveyResult | undefined> => {
    const result = await readStoredResult(bucket, surveyId)
    if (result !== undefined && result.id !== surveyId)
        throw new ResultInvalidError()
    return result
}

/**
 * 結果本体を読み、識別子と実施期間を期待値に照合する。
 *
 * Input: 結果保管用 R2 バケット、期待する識別子と期間
 * Output: 一致する検証済み結果、または未保存なら undefined
 * 例: readMatchingResult(bucket, expected) → result
 */
export const readMatchingResult = async (
    bucket: SurveyResultsBucket,
    expected: { id: string; opensAt: string; closesAt: string },
): Promise<SurveyResult | undefined> => {
    const result = await readStoredResult(bucket, expected.id)
    if (result === undefined) return undefined
    if (result.id !== expected.id) throw new ResultMismatchError()
    if (!resultMatchesIndexEntry({ ...expected, outcome: "result" }, result))
        throw new ResultMismatchError()
    return result
}

/**
 * 結果を上書き禁止で作り、既存の場合は本体を読み直して内容を確認する。
 *
 * Input: 結果保管用 R2 バケット、形式検証済みの結果
 * Output: 新規保存なら "created"、既存本体の確認後は "exists"
 * 例: putResultOnce(bucket, result) → "created"
 */
export const putResultOnce = async (
    bucket: SurveyResultsBucket,
    result: SurveyResult,
): Promise<"created" | "exists"> => {
    if (!parseSurveyResult(result).ok) throw new ResultInvalidError()
    let stored: Awaited<ReturnType<SurveyResultsBucket["put"]>>
    try {
        stored = await bucket.put(
            resultKey(result.id),
            JSON.stringify(result),
            {
                onlyIf: { etagDoesNotMatch: "*" },
                httpMetadata: { contentType: "application/json" },
            },
        )
    } catch {
        throw new ResultInvalidError()
    }
    if (stored !== null) return "created"

    const existing = await readMatchingResult(bucket, result)
    if (existing === undefined) throw new ResultMismatchError()
    return "exists"
}

/**
 * 目録に項目を追加する。既存項目は維持し、etag による比較交換を最大 3 回行う。
 *
 * Input: 結果保管用 R2 バケット、追加する目録項目
 * Output: なし。3 回の比較交換に失敗した場合は例外
 * 例: appendIndexEntry(bucket, entry)
 */
export const appendIndexEntry = async (
    bucket: SurveyResultsBucket,
    entry: SurveyIndex["surveys"][number],
): Promise<void> => {
    for (let attempt = 0; attempt < 3; attempt++) {
        const snapshot = await readIndex(bucket)
        if (snapshot.index.surveys.some(item => item.id === entry.id)) return
        const next: SurveyIndex = {
            ...snapshot.index,
            surveys: [...snapshot.index.surveys, entry],
        }
        if (!parseSurveyIndex(next).ok) throw new IndexInvalidError()
        let written: Awaited<ReturnType<SurveyResultsBucket["put"]>>
        try {
            written = await bucket.put(INDEX_KEY, JSON.stringify(next), {
                onlyIf:
                    snapshot.etag === undefined
                        ? { etagDoesNotMatch: "*" }
                        : { etagMatches: snapshot.etag },
                httpMetadata: { contentType: "application/json" },
            })
        } catch {
            throw new Error("Survey result index write failed")
        }
        if (written !== null) return
    }
    throw new IndexConflictError()
}
