import type { APIRoute } from "astro"
import { AtpAgent } from "@atproto/api"

import { makeSessionSetCookie } from "@/lib/cookies.js"
import * as PostSchema from "@/client/openapi/schemas/v2/session/post"

import { errorResponseFromStatus } from "@/lib/api.js"
import { XRPCError } from "@atproto/xrpc"

/**
 * Skyshare v2 session 作成 API。
 *
 * 概要:
 * - 認証情報を受け取り atproto へ login を実行する。
 * - 取得した session と service を Cookie へ保存し、以後の API で再開可能にする。
 * - 入力不正は 400、認証/レート制限は 401/429、それ以外は 500 を返す。
 */

/**
 * ログインを実行し、セッションCookieを返す API エンドポイント。
 *
 * 想定する入力形状(最小要件):
 * - JSON ボディに `identifier`・`password`・`service` を含む(いずれも必須)
 *
 * 処理の趣旨:
 * - OpenAPI スキーマで入力検証後、AtpAgent.login の成功結果を Cookie 化して返却する。
 *
 * Input:
 * - `request`: Astro APIRoute が受け取る HTTP Request
 *
 * Output:
 * - 成功時: 200 + `set-cookie` ヘッダ
 * - 失敗時: ステータスに応じたエラーレスポンス
 *
 * 例:
 * - 入力: `{ identifier: "alice", password: "***" }`
 * - 出力: `status: 200` と `set-cookie`
 */
export const POST: APIRoute = async ({ request }: { request: Request }) => {
    try {
        const body = PostSchema.RequestBodySchema.safeParse(
            await request.json(),
        )
        if (!body.success) {
            console.warn("login.ts: " + JSON.stringify(body.error))
            return errorResponseFromStatus(400)
        }

        const identifier = body.data.identifier
        const password = body.data.password
        const service = body.data.service || "https://bsky.social"

        const agent = new AtpAgent({ service })
        const response = await agent.login({
            identifier,
            password,
        })
        const session = response.data

        // サーバー側 API が正しくセッション再開できるよう、session と service を同時に保存する。
        const cookiePayload = { session, service }
        const cookie = makeSessionSetCookie(cookiePayload)
        const responeseHeader: PostSchema.ResponseHeaders200Type = {
            "set-cookie": cookie,
        }
        return new Response(undefined, {
            status: 200,
            headers: responeseHeader,
        })
    } catch (err: unknown) {
        console.error("login.ts: ", err)
        if (err instanceof XRPCError) {
            // atproto 側の既知エラーをHTTPステータスへ正規化して返す。
            switch (err.error) {
                case "AuthenticationRequired":
                case "InvalidToken":
                case "ExpiredToken":
                    console.warn("login.ts: AuthenticationRequired")
                    return errorResponseFromStatus(401)
                case "RateLimitExceeded":
                    console.warn("login.ts: RateLimitExceeded")
                    return errorResponseFromStatus(429)
            }
        }
        return errorResponseFromStatus(500)
    }
}
