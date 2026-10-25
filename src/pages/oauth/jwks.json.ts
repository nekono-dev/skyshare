import type { APIRoute } from "astro"

import { errorResponseFromStatus } from "@/lib/api/response.js"
import { getOAuthClientSecret } from "@/lib/oauth/env"
import { clientJwks, loadClientKey } from "@/lib/oauth/client"

/**
 * Bluesky の OAuth のクライアントの公開鍵の一覧（JWKS。ログインと予約投稿で共通）。
 * 認可サーバーがクライアントの証明（private_key_jwt）を検証するために取得する。
 * 鍵が未設定なら 500 を返す。
 */
export const GET: APIRoute = async () => {
    const client = await loadClientKey(await getOAuthClientSecret())
    if (!client) return errorResponseFromStatus(500)
    return new Response(JSON.stringify(clientJwks(client)), {
        headers: {
            "content-type": "application/json",
            "cache-control": "public, max-age=300",
        },
    })
}
