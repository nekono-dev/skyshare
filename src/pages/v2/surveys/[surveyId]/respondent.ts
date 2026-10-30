/**
 * RespondentRoute: ログイン時アンケートの「回答済みの確認（GET）」と「回答済みとしての登録（PUT）」。
 *
 * 責務と処理概要:
 * - 共通の入口（認証・パス・設定と期間・鍵）を通ったあと、回答者の一方向の値を求める。
 * - GET は主キーでの読み取り 1 回で `{ answered }` を返す。PUT は書き込み 1 回で 204 を返し、本文は読まない。
 * - 予期しない失敗（バインディングの取得・値の計算・D1）は内部の情報を含まない 500 にする。
 * - 応答はすべて `cache-control: no-store`。did・値・鍵をログにも応答にも出さない。
 * - `@atproto/*` に依存しない。
 */
import type { APIRoute } from "astro"

import { errorResponseFromStatus } from "@/lib/api/response"
import { respondentHash } from "@/lib/survey/respondentHash"
import {
    noStoreEmpty,
    noStoreJson,
    resolveSurveyRequest,
} from "@/lib/survey/request"
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
        return noStoreJson({ answered })
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
