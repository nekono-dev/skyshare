/**
 * ログイン中の回答を匿名で保存するアンケート API。
 *
 * - 保存する回答にアカウント ID を含めず、回答済み照合にはアンケートごとの HMAC 値を使う。
 * - 回答済み記録と回答は同じ D1 batch で保存し、重複時は回答も残さない。
 * - 生の回答や識別情報をログに出さず、応答はキャッシュさせない。
 */
import type { APIRoute } from "astro"

import { errorResponseFromStatus } from "@/util/http"
import { RequestBodySchema } from "@/lib/api/schema/v2/surveys/[surveyId]/answers/post"
import { answeredOn, checkAnswers } from "@/lib/survey/answers"
import { respondentHash } from "@/lib/survey/respondentHash"
import { noStoreEmpty, resolveSurveyRequest } from "@/lib/survey/request"
import { saveAnswer } from "@/lib/survey/store"

/**
 * 失敗の応答を作る。キャッシュ禁止を付ける。
 *
 * Input: 状態コード
 * Output: no-store 付きのエラー応答
 * 例: fail(400) → 400
 */
const fail = (status: number): Response => {
    const response = errorResponseFromStatus(status)
    response.headers.set("cache-control", "no-store")
    return response
}

/**
 * POST /v2/surveys/{surveyId}/answers/ — 回答を検証して 1 回だけ保存する。
 * 成功は本文なしの 201、同じアカウントの 2 回目は 409、「回答しない」を含む回答は 422。
 */
export const POST: APIRoute = async ({ params, request, locals }) => {
    try {
        const gate = await resolveSurveyRequest({ request, params, locals })
        if (!gate.ok) return gate.response
        const { survey, did, db, hashKey, now } = gate.context

        let json: unknown
        try {
            json = await request.json()
        } catch {
            return fail(400)
        }
        const body = RequestBodySchema.safeParse(json)
        if (!body.success) return fail(400)

        const checked = checkAnswers(survey, body.data.answers)
        if (!checked.ok) {
            return fail(checked.reason === "declined" ? 422 : 400)
        }

        const didHash = await respondentHash(hashKey, survey.id, did)
        const result = await saveAnswer(db, {
            surveyId: survey.id,
            didHash,
            answerId: crypto.randomUUID(),
            answersJson: JSON.stringify(checked.answers),
            answeredOn: answeredOn(now),
        })
        if (result === "duplicate") return fail(409)
        return noStoreEmpty(201)
    } catch (error) {
        // 例外のメッセージには値が混ざりうるため、種類の名前だけを記録する
        console.error(
            "surveys POST answers: unexpected error",
            error instanceof Error ? error.name : typeof error,
        )
        return fail(500)
    }
}
