/**
 * legacy pageDB 投稿の削除 API（v2 セッションの cookie から legacy backend の `DELETE /page` を呼ぶプロキシ）。
 *
 * - accessJwt をクライアントへ渡さないため、削除は必ずこのエンドポイントがサーバー間通信で行う。
 * - OAuth のセッションは、アクセストークンが DPoP に結び付き legacy backend で使えないため、403 で拒否する。
 * - Cloudflare Workers 環境で動作するため Node.js 固有 API は使わない。
 */
import type { APIRoute } from "astro"
import { parseSessionFromRequest } from "@/lib/session/cookies"
import { errorResponseFromStatus } from "@/util/http"
import { hasCookieHeader } from "@/util/http"
import { deletePageDbEntry } from "@/lib/entry/legacyPagedb"

/**
 * 削除リクエストボディを検証する。
 *
 * Input:
 * - `value`: JSON ボディ候補
 *
 * Output:
 * - 検証済み `{ dbIndex, dbKey }`。不正時は `undefined`
 *
 * 例:
 * - 入力: `{ dbIndex: "legacy", dbKey: "alice.bsky.social@3lxyz" }`
 * - 出力: 同等オブジェクト
 */
const parseDeleteBody = (
    value: unknown,
): { dbIndex: string; dbKey: string } | undefined => {
    if (typeof value !== "object" || value === null) {
        return undefined
    }

    const record = value as Record<string, unknown>
    if (
        typeof record.dbIndex !== "string" ||
        typeof record.dbKey !== "string"
    ) {
        return undefined
    }

    if (record.dbIndex !== "legacy" && !/^\d+$/.test(record.dbIndex)) {
        return undefined
    }

    if (!/^[^/@]+@[^/@]+$/.test(record.dbKey)) {
        return undefined
    }

    return { dbIndex: record.dbIndex, dbKey: record.dbKey }
}

/**
 * DELETE /v1/page: legacy pageDB の投稿を削除する。
 *
 * Input:
 * - `request`: cookie と `{ dbIndex, dbKey }` を含む HTTP リクエスト
 *
 * Output:
 * - 200: 本文なし
 * - 4xx/5xx: 共通エラー JSON
 *
 * 例:
 * - 入力: `{ "dbIndex": "0", "dbKey": "did:plc:abc@3lxyz" }`
 * - 出力: `status 200`
 */
export const DELETE: APIRoute = async ({ request }: { request: Request }) => {
    try {
        if (!hasCookieHeader(request)) {
            return errorResponseFromStatus(401)
        }

        let json: unknown
        try {
            json = await request.json()
        } catch (err) {
            console.warn("page.ts: invalid JSON body", err)
            return errorResponseFromStatus(400)
        }

        const body = parseDeleteBody(json)
        if (!body) {
            return errorResponseFromStatus(400)
        }

        // `/posts/{dbIndex}/{slug}`（legacy pageDB 投稿表示ページ）からの削除は、
        // v2 の `atp_session` cookie から Bluesky の DID / accessJwt を復号して行う
        const stored = parseSessionFromRequest(request)
        // legacy backend へは送らず `OAuthSessionUnsupported` で拒否する（画面はアプリパスワードでのログインを案内する）
        if (stored?.kind === "oauth") {
            return new Response(
                JSON.stringify({ error: "OAuthSessionUnsupported" }),
                {
                    status: 403,
                    headers: {
                        "content-type": "application/json",
                        "cache-control": "no-store",
                    },
                },
            )
        }
        const session = stored?.session
        if (!session || !session.did || !session.accessJwt) {
            return errorResponseFromStatus(401)
        }

        const result = await deletePageDbEntry({
            dbIndex: body.dbIndex,
            dbKey: body.dbKey,
            did: session.did,
            accessJwt: session.accessJwt,
        })

        if ("error" in result) {
            switch (result.error) {
                case "BadRequest":
                    return errorResponseFromStatus(400)
                case "RateLimitExceeded":
                    return errorResponseFromStatus(429)
                default:
                    return errorResponseFromStatus(500)
            }
        }

        return new Response(undefined, { status: 200 })
    } catch (error) {
        console.error("page.ts DELETE:", error)
        return errorResponseFromStatus(500)
    }
}
