import type { APIRoute } from "astro"

import {
    parseSessionFromRequest,
    parseAccountsFromRequest,
    makeAccountsSetCookies,
    makeClearSetCookie,
    sessionIdentity,
    SESSION_COOKIE_NAME,
    type StoredSession,
} from "@/lib/session/cookies.js"
import { revokeOAuthSession } from "@/lib/session/oauthSession"
import { errorResponseFromStatus } from "@/lib/api/response.js"

/**
 * Skyshare v2 bsky/session ログアウト API。
 *
 * 責務と処理概要:
 * - `did` はログアウト対象アカウントの識別子であり、リソースそのものを指すパスパラメータとして扱う
 *   （操作をパスに埋め込まない、というAPI設計原則に沿った形。操作の意味は DELETE メソッドが担う）。
 * - 対象がアクティブアカウントなら `atp_session` を失効させる（プールに残りがあっても自動昇格はしない）。
 * - 対象がプール中のアカウントなら `atp_account_<n>` から取り除く。
 * - 対象が OAuth のセッションなら、cookie から除く前に更新用トークンを認可サーバーで取り消す
 *   （取消の失敗では止めない。cookie から除けば、この端末からは使えなくなるため）。
 * - どちらにも該当しなければ 404。
 */

/**
 * DELETE /v2/bsky/session/{did}: 指定アカウントをログアウトする。
 *
 * Input:
 * - `params.did`: ログアウト対象アカウントの did
 * - `request`: cookie を含む HTTP リクエスト
 *
 * Output:
 * - 200: `set-cookie` ヘッダのみ、本文なし
 * - 400: `did` 未指定
 * - 404: 指定 did がアクティブ・プールいずれにも見つからない
 *
 * 例:
 * - 入力: `DELETE /v2/bsky/session/did:plc:abc123`
 * - 出力: `status 200`
 */
export const DELETE: APIRoute = async ({ params, request }) => {
    try {
        const did = params.did
        if (!did) {
            return errorResponseFromStatus(400)
        }

        const activeSession = parseSessionFromRequest(request)
        const pool = parseAccountsFromRequest(request)

        const isActive =
            !!activeSession && sessionIdentity(activeSession).did === did
        const poolIndex = pool.findIndex(
            account => sessionIdentity(account).did === did,
        )

        if (!isActive && poolIndex === -1) {
            return errorResponseFromStatus(404)
        }

        const target: StoredSession = isActive ? activeSession! : pool[poolIndex]!
        if (target.kind === "oauth") {
            await revokeOAuthSession(target, Math.floor(Date.now() / 1000))
        }

        const headers = new Headers()

        if (isActive) {
            // アクティブアカウントのログアウト。プールに他アカウントが残っていても自動昇格はしない
            // （切り替えは常に明示的な PUT /v2/bsky/session で行う）。
            headers.append(
                "set-cookie",
                makeClearSetCookie(SESSION_COOKIE_NAME),
            )
        } else {
            const nextPool = pool.filter((_, index) => index !== poolIndex)
            for (const cookie of makeAccountsSetCookies(nextPool)) {
                headers.append("set-cookie", cookie)
            }
        }
        headers.set("Cache-Control", "no-store")

        return new Response(undefined, { status: 200, headers })
    } catch (err) {
        console.error("session/[did].ts DELETE:", err)
        return errorResponseFromStatus(500)
    }
}
