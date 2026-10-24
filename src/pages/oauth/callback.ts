import type { APIRoute } from "astro"

import { toAuthorizationFragment } from "@/lib/schedule/oauth/callbackFragment"
import {
    clearReturnPathCookie,
    readReturnPath,
} from "@/lib/schedule/oauth/returnPath"

/**
 * 予約投稿の OAuth の認可の戻り先（redirect_uri）。
 *
 * 責務と処理概要:
 * - 認可の画面からの戻りの項目を、許可を始めたページ（開始時の cookie のパス。無ければ設定の
 *   ページ）の住所のフラグメント（`#` 以降）へ移して転送し、戻り先のパスの cookie を消す。
 * - 認可の完了は、転送先のページが `POST /v2/schedules/credential/authorization/completion/` で行う。
 *
 * 実装上の制約:
 * - 戻りは別のサイトからの遷移のため、`SameSite=Strict` のセッションの cookie が届かない。
 *   ここではセッションを使わず、トークンの取得もしない。
 * - 項目をクエリのまま渡すと、アクセス解析や Referer に認可コードが載る。
 *   フラグメントはサーバーへも送られないため、フラグメントで渡す。
 */
export const GET: APIRoute = ({ request }) => {
    const to = new URL(
        readReturnPath(request.headers.get("cookie")),
        request.url,
    )
    to.hash = toAuthorizationFragment(new URL(request.url).searchParams)
    return new Response(null, {
        status: 303,
        headers: {
            location: to.toString(),
            "cache-control": "no-store",
            "referrer-policy": "no-referrer",
            "set-cookie": clearReturnPathCookie(),
        },
    })
}
