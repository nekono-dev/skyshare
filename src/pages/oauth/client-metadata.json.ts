import type { APIRoute } from "astro"

import { clientMetadata } from "@/lib/schedule/oauth/client"

/**
 * 予約投稿の OAuth のクライアントのメタデータ（client_id の URL）。
 *
 * 配信しているオリジンごとにクライアントの識別子・戻り先が決まるため、要求のオリジンから作る。
 * 認可サーバーが取得するため、キャッシュは短くする。
 */
export const GET: APIRoute = ({ request }) =>
    new Response(
        JSON.stringify(clientMetadata(new URL(request.url).origin, "Skyshare")),
        {
            headers: {
                "content-type": "application/json",
                "cache-control": "public, max-age=300",
            },
        },
    )
