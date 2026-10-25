import type { APIRoute } from "astro"

import { errorResponseFromStatus } from "@/lib/api/response.js"
import * as Schema from "@/lib/api/schema/v2/schedules/credential/authorization/completion/post"
import { makeScheduleHintClearCookie } from "@/lib/schedule/availabilityHint"
import { getScheduleEnv } from "@/lib/schedule/env"
import { completeAuthorization } from "@/lib/schedule/oauth/flow"
import { jsonResponse } from "@/lib/schedule/scheduleResponse"

/**
 * Skyshare v2 schedules/credential/authorization/completion API（予約投稿の OAuth の認可の完了）。
 *
 * - POST: 認可の画面からの戻りの項目を受け、認可コードをトークンに替えて保管し、結果を返す。
 *
 * 実装上の制約:
 * - 戻り（`/oauth/callback/`）は別のサイトからの遷移で、`SameSite=Strict` のセッションの
 *   cookie が届かない。そのため戻りでは項目を設定のページへ渡すだけにし、ログイン中の
 *   アカウントの照合とトークンの取得は、同じサイトから呼ばれるこの API で行う。
 * - トークンと認可コードをログに出さない。
 */
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
        return jsonResponse(res, 200, [makeScheduleHintClearCookie()])
    } catch {
        console.error("schedule authorization completion: unexpected error")
        return errorResponseFromStatus(500)
    }
}
