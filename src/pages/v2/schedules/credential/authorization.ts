import type { APIRoute } from "astro"

import { errorResponseFromStatus } from "@/lib/api/response.js"
import * as PostSchema from "@/lib/api/schema/v2/schedules/credential/authorization/post"
import { getScheduleEnv } from "@/lib/schedule/env"
import { startAuthorization } from "@/lib/schedule/oauth/flow"
import { returnCookie } from "@/lib/oauth/returnPath"
import { jsonResponse } from "@/lib/schedule/scheduleResponse"

/**
 * Skyshare v2 schedules/credential/authorization API（予約投稿の OAuth の認可）。
 *
 * - POST: ログイン中のアカウントで認可を開始し、利用者を送る認可の画面の URL を返す。
 *   本文の `returnTo`（許可を始めたページのパス）を、戻り先だけに送られる cookie に入れる。
 * - 戻り先は `/oauth/callback/`、完了は `authorization/completion` が受け持つ。
 *
 * 実装上の制約:
 * - `@atproto/*` を読み込まない（予約の実行と同じ、WebCrypto と fetch だけの実装を使う）。
 * - トークンと認可コードをログに出さない。
 */

export const POST: APIRoute = async ({ request, locals }) => {
    try {
        const { session } = locals
        if (!session) return errorResponseFromStatus(401)
        // 本文は省略できる（省略時は設定のページへ戻す）
        const text = await request.text()
        let body: PostSchema.RequestBodyType = {}
        if (text.trim() !== "") {
            let raw: unknown
            try {
                raw = JSON.parse(text)
            } catch {
                return errorResponseFromStatus(400)
            }
            const parsed = PostSchema.RequestBodySchema.safeParse(raw)
            if (!parsed.success) return errorResponseFromStatus(400)
            body = parsed.data
        }
        const env = await getScheduleEnv()
        const result = await startAuthorization(env, {
            origin: new URL(request.url).origin,
            did: session.did,
            now: Math.floor(Date.now() / 1000),
        })
        if (!result.ok) {
            if (result.code)
                console.error(`schedule authorization: ${result.code}`)
            return errorResponseFromStatus(result.status)
        }
        const res: PostSchema.ResponseBody200Type = { url: result.url }
        const response = jsonResponse(res)
        response.headers.append(
            "set-cookie",
            returnCookie("schedule", body.returnTo),
        )
        return response
    } catch {
        console.error("schedule authorization POST: unexpected error")
        return errorResponseFromStatus(500)
    }
}
