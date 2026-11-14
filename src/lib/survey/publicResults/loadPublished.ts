/**
 * 結果の保管先から公開済みのアンケート結果を検証して取り込む。
 *
 * - エラーには失敗の種類と検証済みのアンケート識別子だけを含める。
 * - 全体の所要時間と各オブジェクトの大きさ・目録の件数に上限を設ける。
 */

import {
    INDEX_KEY,
    isVisible,
    parseSurveyIndex,
    parseSurveyResult,
    parseSurveyVisibility,
    resultKey,
    resultMatchesIndexEntry,
    visibilityKey,
} from "@/lib/survey/results/schema"
import type { SurveyIndex, SurveyResult } from "@/lib/survey/results/schema"

export type ResultsReader = {
    get: (
        key: string,
    ) => Promise<{ size: number; text: () => Promise<string> } | null>
}

export type LoadLimits = {
    totalTimeoutMs: number
    maxIndexBytes: number
    maxResultBytes: number
    maxVisibilityBytes: number
    maxSurveys: number
}

export const DEFAULT_LOAD_LIMITS: LoadLimits = {
    totalTimeoutMs: 30_000,
    maxIndexBytes: 65_536,
    maxResultBytes: 262_144,
    maxVisibilityBytes: 1_024,
    maxSurveys: 200,
}

export type LoadFailureKind =
    | "read"
    | "timeout"
    | "limit"
    | "invalid-json"
    | "invalid"
    | "missing"
    | "mismatch"

export class SurveyResultsLoadError extends Error {
    readonly kind: LoadFailureKind
    readonly surveyId: string | undefined

    constructor(kind: LoadFailureKind, surveyId?: string) {
        super(
            `survey results load failed: ${kind}${surveyId ? ` (${surveyId})` : ""}`,
        )
        this.name = "SurveyResultsLoadError"
        this.kind = kind
        this.surveyId = surveyId
    }
}

const readJson = async (
    reader: ResultsReader,
    key: string,
    maxBytes: number,
    surveyId?: string,
): Promise<{ present: false } | { present: true; value: unknown }> => {
    let object: Awaited<ReturnType<ResultsReader["get"]>>
    try {
        object = await reader.get(key)
    } catch {
        throw new SurveyResultsLoadError("read", surveyId)
    }
    if (object === null) return { present: false }
    if (object.size > maxBytes)
        throw new SurveyResultsLoadError("limit", surveyId)

    let body: string
    try {
        body = await object.text()
    } catch {
        throw new SurveyResultsLoadError("read", surveyId)
    }
    if (new TextEncoder().encode(body).byteLength > maxBytes) {
        throw new SurveyResultsLoadError("limit", surveyId)
    }
    try {
        return { present: true, value: JSON.parse(body) as unknown }
    } catch {
        throw new SurveyResultsLoadError("invalid-json", surveyId)
    }
}

const load = async (
    reader: ResultsReader,
    limits: LoadLimits,
): Promise<SurveyResult[]> => {
    const indexObject = await readJson(reader, INDEX_KEY, limits.maxIndexBytes)
    if (!indexObject.present) return []

    const parsedIndex = parseSurveyIndex(indexObject.value)
    if (!parsedIndex.ok) throw new SurveyResultsLoadError("invalid")
    const index: SurveyIndex = parsedIndex.value
    if (index.surveys.length > limits.maxSurveys) {
        throw new SurveyResultsLoadError("limit")
    }

    const published: SurveyResult[] = []
    for (const entry of index.surveys) {
        if (entry.outcome === "empty") continue

        const visibilityObject = await readJson(
            reader,
            visibilityKey(entry.id),
            limits.maxVisibilityBytes,
            entry.id,
        )
        let visibility
        if (visibilityObject.present) {
            const parsedVisibility = parseSurveyVisibility(
                visibilityObject.value,
            )
            if (!parsedVisibility.ok) {
                throw new SurveyResultsLoadError("invalid", entry.id)
            }
            visibility = parsedVisibility.value
        }
        if (!isVisible(visibility)) continue

        const resultObject = await readJson(
            reader,
            resultKey(entry.id),
            limits.maxResultBytes,
            entry.id,
        )
        if (!resultObject.present) {
            throw new SurveyResultsLoadError("missing", entry.id)
        }
        const parsedResult = parseSurveyResult(resultObject.value)
        if (!parsedResult.ok)
            throw new SurveyResultsLoadError("invalid", entry.id)
        if (!resultMatchesIndexEntry(entry, parsedResult.value)) {
            throw new SurveyResultsLoadError("mismatch", entry.id)
        }
        published.push(parsedResult.value)
    }

    return published.sort((left, right) => {
        const opensDifference =
            Date.parse(right.opensAt) - Date.parse(left.opensAt)
        if (opensDifference !== 0) return opensDifference
        const closesDifference =
            Date.parse(right.closesAt) - Date.parse(left.closesAt)
        if (closesDifference !== 0) return closesDifference
        if (left.id < right.id) return -1
        if (left.id > right.id) return 1
        return 0
    })
}

/**
 * 結果の保管先から公開済みの結果を読み込み、実施時期の新しい順に返す。
 *
 * Input: 構造的な読み取り専用バケット、必要なら取得上限
 * Output: 公開済みの検証済み結果
 * 例: 目録が無い場合は空配列を返し、取得や検証に失敗した場合は種類付きエラーを投げる
 */
export const loadPublishedSurveys = (
    reader: ResultsReader,
    limits: LoadLimits = DEFAULT_LOAD_LIMITS,
): Promise<SurveyResult[]> => {
    let timeoutHandle: ReturnType<typeof setTimeout>
    const timeout = new Promise<never>((_resolve, reject) => {
        timeoutHandle = setTimeout(
            () => reject(new SurveyResultsLoadError("timeout")),
            limits.totalTimeoutMs,
        )
    })
    return Promise.race([load(reader, limits), timeout]).finally(() => {
        clearTimeout(timeoutHandle)
    })
}
