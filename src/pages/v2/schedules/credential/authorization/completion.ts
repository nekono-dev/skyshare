/**
 * 予約投稿用 OAuth 認可を完了する API。
 *
 * - 外部サイトからの戻りでは SameSite=Strict のセッション cookie が届かないため、同一サイトから完了処理を呼ぶ。
 * - 認可コードとトークンをログに出さず、登録状態ヒント cookie を失効させる。
 */
import type { APIRoute } from "astro"

import { errorResponseFromStatus, jsonResponse } from "@/util/http"
import * as Schema from "@/lib/api/schema/v2/schedules/credential/authorization/completion/post"
import { makeScheduleHintClearCookie } from "@/lib/schedule/availabilityHint"
import { getScheduleEnv } from "@/lib/schedule/env"
import { completeAuthorization } from "@/lib/schedule/oauth/flow"

export const POST: APIRoute = async ({ request, locals }) => {
    try {
        const { session } = locals
        if (!session) return errorResponseFromStatus(401)
        let raw: unknown
        try {
            raw = await request.json()
        } catch {
            return errorResponseFromStatus(400)
        }
        const body = Schema.RequestBodySchema.safeParse(raw)
        if (!body.success) return errorResponseFromStatus(400)
        const env = await getScheduleEnv()
        const result = await completeAuthorization(env, {
            origin: new URL(request.url).origin,
            did: session.did,
            now: Math.floor(Date.now() / 1000),
            query: body.data,
        })
        const res: Schema.ResponseBody200Type = {
            result: result.ok ? "ok" : result.code,
        }
        // 登録状態が変わるため、ヒント cookie を失効させて次の表示で取り直させる
        return jsonResponse(res, {
            headers: [
                ["cache-control", "no-store"],
                ["set-cookie", makeScheduleHintClearCookie()],
            ],
        })
    } catch {
        console.error("schedule authorization completion: unexpected error")
        return errorResponseFromStatus(500)
    }
}
