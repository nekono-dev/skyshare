/**
 * AnswersRoute: ログイン時アンケートの回答を匿名で保存する（POST）。
 *
 * 責務と処理概要:
 * - 順序は 前処理(401/400/404/503) → 本文の JSON と形式(400) → 設定との照合
 *   (構造の不正は 400、「回答しない」を含む回答は 422) → 回答者の値の計算 → 1 回の保存
 *   (重複は 409、成功は本文なしの 201)。
 * - 回答の識別子は乱数、回答した日は日本標準時の暦。事前の読み取りはしない。
 * - 失敗の記録に、回答者の識別子・値・回答の内容・鍵を含めない（例外の種類の名前だけを記録する）。
 * - 予期しない失敗（バインディングの取得の失敗を含む）は内部情報を含まない 500。
 * - すべての応答に `cache-control: no-store` を付ける。
 * - `@atproto/*` を import しない（無料枠の CPU 時間を守るため）。
 */
import type { APIRoute } from "astro"

import { errorResponseFromStatus } from "@/lib/api/response"
import { RequestBodySchema } from "@/lib/api/schema/v2/surveys/_surveyId/answers/post"
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
