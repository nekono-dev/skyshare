/**
 * Skyshare v2 bsky/session ログアウト API（DELETE。`did` はリソースを指すパスパラメータで、操作の意味は DELETE が担う）。
 *
 * - 対象がアクティブなら `atp_session` を失効させ、プール中なら `atp_account_<n>` から取り除く。どちらにも無ければ 404。
 * - OAuth のセッションは、cookie から除く前に更新用トークンを認可サーバーで取り消す。
 */
import { makeScheduleHintClearCookie } from "@/lib/schedule/availabilityHint"
import type { APIRoute } from "astro"

import {
    parseSessionFromRequest,
    parseAccountsFromRequest,
    makeAccountsSetCookies,
    makeClearSetCookie,
    sessionIdentity,
    SESSION_COOKIE_NAME,
    type StoredSession,
} from "@/lib/session/cookies"
import { revokeOAuthSession } from "@/lib/session/oauthSession"
import { errorResponseFromStatus } from "@/util/http"

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

        const target: StoredSession = isActive
            ? activeSession!
            : pool[poolIndex]!
        // 取消の失敗では止めない。cookie から除けば、この端末からは使えなくなるため
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
            // アクティブなアカウントが変わるため、予約投稿の登録状態のヒント cookie を失効させる
            headers.append("set-cookie", makeScheduleHintClearCookie())
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
