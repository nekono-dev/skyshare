/**
 * Bluesky の OAuth の認可の戻り先（redirect_uri。ログインと予約投稿で共通）。
 *
 * - 戻りは別サイトからの遷移で `SameSite=Strict` のセッション cookie が届かないため、セッションもトークン取得も使わない。
 * - 項目をクエリのまま渡すとアクセス解析や Referer に認可コードが載る。フラグメントはサーバーへ送られない。
 */
import type { APIRoute } from "astro"

import { toAuthorizationFragment } from "@/lib/oauth/callbackFragment"
import { clearReturnCookie, readReturn } from "@/lib/oauth/returnPath"

// 認可画面からの戻りの項目を、許可を始めたページ（開始時の cookie の用途とページ。無ければ予約の設定のページ）の
// 住所のフラグメント（`#` 以降）へ用途とともに移して転送し、戻り先の cookie を消す。
// 認可の完了は、転送先のページが用途ごとの完了の API
// （ログインは `POST /v2/bsky/session/authorization/completion/`、
// 予約投稿は `POST /v2/schedules/credential/authorization/completion/`）で行う。
// 手元の開発サーバーでは、ループバックの戻り先への遷移を開発サーバーの中継がここへ転送する。
export const GET: APIRoute = ({ request }) => {
    const { purpose, path } = readReturn(request.headers.get("cookie"))
    const to = new URL(path, request.url)
    to.hash = toAuthorizationFragment(
        new URL(request.url).searchParams,
        purpose,
    )
    return new Response(null, {
        status: 303,
        headers: {
            location: to.toString(),
            "cache-control": "no-store",
            "referrer-policy": "no-referrer",
            "set-cookie": clearReturnCookie(),
        },
    })
}
