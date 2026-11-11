/**
 * 予約投稿用 OAuth 認可を開始する API。
 *
 * - 戻り先は cookie に保存し、認可コードとトークンはログに出さない。
 * - `@atproto/*` を使わず、WebCrypto と fetch で認可を行う。
 */
import type { APIRoute } from "astro"

import { errorResponseFromStatus, jsonResponse } from "@/util/http"
import * as PostSchema from "@/lib/api/schema/v2/schedules/credential/authorization/post"
import { getScheduleEnv } from "@/lib/schedule/env"
import { startAuthorization } from "@/lib/schedule/oauth/flow"
import { returnCookie } from "@/lib/oauth/returnPath"

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
        const response = jsonResponse(res, {
            headers: { "cache-control": "no-store" },
        })
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
