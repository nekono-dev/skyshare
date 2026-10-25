import { makeScheduleHintClearCookie } from "@/lib/schedule/availabilityHint"
import type { APIRoute } from "astro"

import { errorResponseFromStatus } from "@/lib/api/response.js"
import * as PostSchema from "@/lib/api/schema/v2/bsky/session/authorization/completion/post"
import {
    admitSession,
    makeAccountsSetCookies,
    makeSessionSetCookie,
    parseAccountsFromRequest,
    parseSessionFromRequest,
} from "@/lib/session/cookies.js"
import {
    clearPendingCookie,
    completeOAuthLogin,
    readPendingCookie,
} from "@/lib/session/oauthLogin"

/**
 * Skyshare v2 bsky/session/authorization/completion API（Bluesky の OAuth によるログインの完了）。
 *
 * 責務と処理概要:
 * - POST: 認可の画面からの戻りの項目を受け、開始時の途中の状態（cookie）と照合して OAuth のセッションを作り、
 *   アプリパスワードのログインと同じ規則（`admitSession`）でアクティブにする。別のアカウントが
 *   アクティブならプールへ退避し、プールが上限なら 409 にする。
 * - 成否によらず、途中の状態の cookie を消す（同じ戻りを使い回させないため）。
 *
 * 実装上の制約:
 * - 戻りは別のサイトからの遷移で `SameSite=Strict` の cookie が届かないため、戻ったページ（同じサイト）から呼ぶ。
 * - 全応答に `Cache-Control: no-store` を付け、トークン・認可コード・鍵をログにも応答にも出さない。
 */

/**
 * ログインを完了する。
 *
 * Input:
 * - `request`: cookie（途中の状態・現在のセッションとプール）と本文 `{ code?, state?, iss?, error? }`
 *
 * Output:
 * - 200: `{ result: "ok" }` とセッション・プールの `Set-Cookie`、または `{ result: <失敗の分類> }`
 * - 400: 本文が不正、409: アカウント数の上限、500: 想定外の例外
 *
 * 例:
 * - 入力: `{ "code": "...", "state": "...", "iss": "https://bsky.social" }` → 出力: `{ "result": "ok" }`
 */
export const POST: APIRoute = async ({ request }) => {
    const headers = new Headers({
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
    })
    headers.append("set-cookie", clearPendingCookie())
    const respond = (status: number, body?: PostSchema.ResponseBody200Type) =>
        new Response(body ? JSON.stringify(body) : undefined, {
            status,
            headers,
        })
    try {
        let raw: unknown
        try {
            raw = await request.json()
        } catch {
            return withHeaders(errorResponseFromStatus(400), headers)
        }
        const body = PostSchema.RequestBodySchema.safeParse(raw)
        if (!body.success) {
            return withHeaders(errorResponseFromStatus(400), headers)
        }

        const cookieHeader = request.headers.get("cookie")
        const result = await completeOAuthLogin({
            pending: readPendingCookie(cookieHeader),
            query: body.data,
            now: Math.floor(Date.now() / 1000),
        })
        if (!result.ok) {
            console.warn(`session authorization completion: ${result.code}`)
            return respond(200, { result: result.code })
        }

        const pool = admitSession(
            parseSessionFromRequest(request),
            parseAccountsFromRequest(request),
            result.session,
        )
        if (!pool) {
            // アカウント数の上限到達。利用者向けの文言はクライアントが状態から選ぶ
            return withHeaders(errorResponseFromStatus(409), headers)
        }
        headers.append("set-cookie", makeSessionSetCookie(result.session))
        for (const cookie of makeAccountsSetCookies(pool)) {
            headers.append("set-cookie", cookie)
        }
        // アクティブなアカウントが変わるため、予約投稿の登録状態のヒント cookie を失効させる
        headers.append("set-cookie", makeScheduleHintClearCookie())
        return respond(200, { result: "ok" })
    } catch {
        console.error("session authorization completion POST: unexpected error")
        return withHeaders(errorResponseFromStatus(500), headers)
    }
}

/**
 * エラーの応答に、途中の状態の cookie の消去とキャッシュの禁止を足す（内部ユーティリティ）。
 *
 * Input: `res`（エラーの応答）、`headers`（足すヘッダー）
 * Output: ヘッダーを足した応答
 */
const withHeaders = (res: Response, headers: Headers): Response => {
    const merged = new Headers(res.headers)
    for (const cookie of headers.getSetCookie()) {
        merged.append("set-cookie", cookie)
    }
    merged.set("Cache-Control", "no-store")
    return new Response(res.body, { status: res.status, headers: merged })
}
