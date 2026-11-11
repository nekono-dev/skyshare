/**
 * アンケート API の共通前処理を行う。
 *
 * - 判定順は認証 (401)、ID 形式 (400)、設定・開催中の一致 (404)、鍵 (503)。失敗時は D1 に触れない。
 * - 設定なし・取得失敗・期間外は同じ 404。did は `locals.session.did` からだけ取得し、鍵と did は応答・ログに出さない。
 * - 応答は `cache-control: no-store`。
 */
import { errorResponseFromStatus } from "@/util/http"
import { PathParamsSchema } from "@/lib/api/contract/surveyPath"
import type { D1Database } from "@/lib/platform/cfTypes"
import type { Survey } from "@/lib/survey/definition"
import { getSurveyEnv } from "@/lib/survey/env"
import { readSurveyConfig } from "@/lib/survey/loadConfig"
import { currentSurvey } from "@/lib/survey/period"

/** 通った後の文脈。D1 のバインディングと鍵を含む */
export type SurveyRequestContext = {
    survey: Survey
    did: string
    db: D1Database
    hashKey: string
    now: Date
}

/** 判定の結果。失敗時はそのまま返せる応答を持つ */
export type SurveyRequestResult =
    | { ok: true; context: SurveyRequestContext }
    | { ok: false; response: Response }

/**
 * 本文のない応答にキャッシュ禁止を付けて返す。
 *
 * Input: 状態コード
 * Output: 本文なしで `cache-control: no-store` を持つ Response
 * 例: noStoreEmpty(204) → 204
 */
export const noStoreEmpty = (status: number): Response =>
    new Response(null, {
        status,
        headers: { "cache-control": "no-store" },
    })

/**
 * 3 つの操作の前処理を決まった順序で行う。
 *
 * Input: request（原点の取得に使う）、params（surveyId）、locals（session）、now（省くと現在時刻）
 * Output: 通れば文脈、失敗なら返すべき応答（401/400/404/503）
 * 例: 期間内の既知の surveyId で認証済み・鍵あり → { ok: true, context }
 */
export const resolveSurveyRequest = async (args: {
    request: Request
    params: Record<string, string | undefined>
    locals: { session?: { did: string } }
    now?: Date
}): Promise<SurveyRequestResult> => {
    const fail = (status: number): SurveyRequestResult => ({
        ok: false,
        response: errorResponseFromStatus(status),
    })

    const session = args.locals.session
    if (!session) return fail(401)

    const path = PathParamsSchema.safeParse({
        surveyId: args.params.surveyId,
    })
    if (!path.success) return fail(400)

    const env = await getSurveyEnv()
    const now = args.now ?? new Date()
    const config = await readSurveyConfig(
        env.ASSETS,
        new URL(args.request.url).origin,
    )
    if (!config) return fail(404)
    const survey = currentSurvey(config, now)
    if (!survey || survey.id !== path.data.surveyId) return fail(404)

    if (!env.SURVEY_HASH_KEY) return fail(503)

    return {
        ok: true,
        context: {
            survey,
            did: session.did,
            db: env.DB,
            hashKey: env.SURVEY_HASH_KEY,
            now,
        },
    }
}
