/**
 * Skyshare v2 bsky/video/upload-token API。
 *
 * 責務と処理概要:
 * - Cookie セッションを検証した上で、Bluesky 動画サービスへ動画を直接アップロードするための
 *   サービス認証トークンを発行して返す。動画の実体は Workers を経由しない（NFR-1）。
 * - トークンはログに出力せず、キャッシュもさせない（NFR-2）。
 */
import type { APIRoute } from "astro"

import {
    errorResponseFromStatus,
    resolveXrpcStatus,
} from "@/lib/api/response.js"
import { createVideoUploadToken } from "@/lib/atproto/videoAuth"

/**
 * POST /v2/bsky/video/upload-token: 動画アップロード用トークンを発行する。
 *
 * Output:
 * - 200: `{ token, did, expiresAt }`（`Cache-Control: no-store`）
 * - 400: 対応PDS（bsky.social 系）以外のアカウント
 * - 401: 未認証
 * - 500: トークン発行失敗
 */
export const POST: APIRoute = async ({ locals }) => {
    try {
        const { agent, session } = locals
        if (!agent || !session) {
            return errorResponseFromStatus(401)
        }

        const result = await createVideoUploadToken(
            agent,
            session as { did: string; didDoc?: unknown },
            Math.floor(Date.now() / 1000),
        )
        if (!result.ok) {
            return errorResponseFromStatus(result.status)
        }

        return new Response(
            JSON.stringify({
                token: result.token,
                did: result.did,
                expiresAt: result.expiresAt,
            }),
            {
                status: 200,
                headers: {
                    "Content-Type": "application/json",
                    "Cache-Control": "no-store",
                },
            },
        )
    } catch (err) {
        // トークンを含みうる値はログに出さない
        console.error(
            "bsky/video/upload-token.ts POST:",
            err instanceof Error ? err.message : "unknown error",
        )
        return errorResponseFromStatus(resolveXrpcStatus(err))
    }
}
