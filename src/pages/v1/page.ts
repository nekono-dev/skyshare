/**
 * legacy pageDB 投稿削除 API（v2 セッションを経由した legacy backend へのプロキシ）。
 *
 * 責務と処理概要:
 * - `/posts/{dbIndex}/{slug}` (legacy pageDB 投稿表示ページ)からの削除リクエストを受け付ける。
 * - v2 の `atp_session` cookie から Bluesky の DID / accessJwt を復号し、
 *   legacy backend の `DELETE /page` をサーバー間通信で呼び出す。
 * - accessJwt をクライアントへ渡さずに済むよう、削除操作は必ずこのエンドポイント経由で行う。
 *
 * 実装上の制約:
 * - Cloudflare Workers 環境で動作するため Node.js 固有 API は使わない。
 */

import type { APIRoute } from "astro"
import { parseSessionFromRequest } from "@/lib/cookies.js"
import { convertHeaderToObj, errorResponseFromStatus } from "@/lib/api.js"
import { deletePageDbEntry } from "@/util/legacy/pagedb"

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
 * Cookie ヘッダの存在を検証する。
 *
 * Input:
 * - `request`: HTTP リクエスト
 *
 * Output:
 * - cookie があれば `true`
 */
const hasCookieHeader = (request: Request): boolean => {
    const headers = convertHeaderToObj(request.headers)
    return typeof headers.cookie === "string" && headers.cookie.length > 0
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

        const { session } = parseSessionFromRequest(request)
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
