/**
 * ログイン中の回答済み状態を確認・登録するアンケート API。
 *
 * - 回答済み照合にはアンケートごとの HMAC 値を使い、did と鍵をログや応答に出さない。
 * - 登録は冪等で、すべての応答をキャッシュさせない。
 */
import type { APIRoute } from "astro"

import { errorResponseFromStatus, jsonResponse } from "@/util/http"
import { respondentHash } from "@/lib/survey/respondentHash"
import { noStoreEmpty, resolveSurveyRequest } from "@/lib/survey/request"
import { isRespondent, registerRespondent } from "@/lib/survey/store"

/**
 * 内部の情報を含まない 500 を返す。例外の中身は記録しない。
 *
 * Input: 操作名（固定の文字列）
 * Output: no-store の 500 応答
 * 例: internalError("get") → 500
 */
const internalError = (operation: string): Response => {
    console.error(`survey respondent ${operation} failed`)
    const response = errorResponseFromStatus(500)
    response.headers.set("cache-control", "no-store")
    return response
}

/**
 * GET /v2/surveys/{surveyId}/respondent/ — 回答済みかを真偽で返す。
 *
 * Input: Astro のコンテキスト（request・params・locals）
 * Output: 200 `{ answered }`、または入口の失敗（401/400/404/503）・500
 * 例: 未回答 → 200 { "answered": false }
 */
export const GET: APIRoute = async ({ request, params, locals }) => {
    try {
        const gate = await resolveSurveyRequest({ request, params, locals })
        if (!gate.ok) return gate.response
        const { survey, did, db, hashKey } = gate.context
        const hash = await respondentHash(hashKey, survey.id, did)
        const answered = await isRespondent(db, survey.id, hash)
        return jsonResponse(
            { answered },
            { headers: { "cache-control": "no-store" } },
        )
    } catch {
        return internalError("get")
    }
}

/**
 * PUT /v2/surveys/{surveyId}/respondent/ — 回答済みとして登録する。本文は読まない。
 *
 * Input: Astro のコンテキスト（request・params・locals）
 * Output: 204（繰り返しても同じ）、または入口の失敗（401/400/404/503）・500
 * 例: 登録 → 204
 */
export const PUT: APIRoute = async ({ request, params, locals }) => {
    try {
        const gate = await resolveSurveyRequest({ request, params, locals })
        if (!gate.ok) return gate.response
        const { survey, did, db, hashKey } = gate.context
        const hash = await respondentHash(hashKey, survey.id, did)
        await registerRespondent(db, survey.id, hash)
        return noStoreEmpty(204)
    } catch {
        return internalError("put")
    }
}
