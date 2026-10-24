import type { APIRoute } from "astro"

import { errorResponseFromStatus } from "@/lib/api/response.js"
import { getScheduleEnv } from "@/lib/schedule/env"
import { clientJwks, loadClientKey } from "@/lib/schedule/oauth/client"

/**
 * 予約投稿の OAuth のクライアントの公開鍵の一覧（JWKS）。
 * 認可サーバーがクライアントの証明（private_key_jwt）を検証するために取得する。
 * 鍵が未設定なら 500 を返す。
 */
export const GET: APIRoute = async () => {
    const env = await getScheduleEnv()
    const client = await loadClientKey(env.SCHEDULE_OAUTH_KEY)
    if (!client) return errorResponseFromStatus(500)
    return new Response(JSON.stringify(clientJwks(client)), {
        headers: {
            "content-type": "application/json",
            "cache-control": "public, max-age=300",
        },
    })
}
