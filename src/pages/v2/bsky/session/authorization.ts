import type { APIRoute } from "astro"

import { errorResponseFromStatus } from "@/lib/api/response.js"
import * as PostSchema from "@/lib/api/schema/v2/bsky/session/authorization/post"
import { returnCookie } from "@/lib/oauth/returnPath"
import { pendingCookie, startOAuthLogin } from "@/lib/session/oauthLogin"

/**
 * Skyshare v2 bsky/session/authorization API（Bluesky の OAuth によるログインの開始）。
 *
 * 責務と処理概要:
 * - POST: ユーザー名を受け取らずに Bluesky の認可サーバーへ認可の要求を事前に送り、認可の画面の住所を返す。
 *   照合に使う途中の状態を、完了の API だけに送る cookie に入れる。本文の `returnTo`（認可の画面から戻ったときに
 *   表示するページ）は、用途 `session` とともに戻り先だけに送られる cookie に入れる。
 * - 戻り先は `/oauth/callback/`、完了は `authorization/completion` が受け持つ。
 *
 * 実装上の制約:
 * - ログインの前に呼ぶため、セッションを要求しない（`/v2/bsky/session` 配下は自動再開の対象外）。
 * - 全応答に `Cache-Control: no-store` を付け、トークンと鍵をログにも応答にも出さない。
 */

/**
 * ログインを開始する。
 *
 * Input:
 * - `request`: 本文 `{ returnTo?, loginHint? }`（省略できる）
 *
 * Output:
 * - 200: `{ url }` と、途中の状態と戻り先の `Set-Cookie`
 * - 400: 本文が不正、500: 秘密鍵の未設定、502: 認可サーバーの不調
 *
 * 例:
 * - 入力: `{ "returnTo": "/accounts/" }` → 出力: `{ "url": "https://bsky.social/oauth/authorize?..." }`
 */
export const POST: APIRoute = async ({ request }) => {
    try {
        // 本文は省略できる（省略時はログインのページへ戻す）
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

        const result = await startOAuthLogin({
            origin: new URL(request.url).origin,
            loginHint: body.loginHint,
            now: Math.floor(Date.now() / 1000),
        })
        if (!result.ok) return errorResponseFromStatus(result.status)

        const res: PostSchema.ResponseBody200Type = { url: result.url }
        const headers = new Headers({
            "Content-Type": "application/json",
            "Cache-Control": "no-store",
        })
        headers.append("set-cookie", pendingCookie(result.pending))
        headers.append("set-cookie", returnCookie("session", body.returnTo))
        return new Response(JSON.stringify(res), { status: 200, headers })
    } catch {
        console.error("session authorization POST: unexpected error")
        return errorResponseFromStatus(500)
    }
}
