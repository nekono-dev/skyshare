/**
 * 予約投稿の作成と一覧を提供する API。
 *
 * - `@atproto/*` を読み込まず、無料枠の CPU 時間を抑える。
 * - 入力と認証を確認し、予約の判断は schedule ライブラリに委ねる。
 */
import type { APIRoute } from "astro"

import { errorResponseFromStatus, jsonResponse } from "@/util/http"
import { convertHeaderToObj } from "@/util/http"
import * as PostSchema from "@/lib/api/schema/v2/schedules/post"
import * as GetSchema from "@/lib/api/schema/v2/schedules/get"
import { codeErrorResponse } from "@/lib/schedule/scheduleResponse"
import {
    createSchedule,
    listScheduleSummaries,
} from "@/lib/schedule/scheduleCollection"

/**
 * POST /v2/schedules — 予約を作成する。
 *
 * 検証の順序: ヘッダー → セッション → 入力 → 実行時刻 → 認証情報の登録 → 待機中の件数 → 画像の保管 → 予約の保存
 * （セッションの後の判断は `createSchedule` が行う）。
 */
export const POST: APIRoute = async ({ request, locals }) => {
    try {
        const head = PostSchema.RequestHeaderSchema.safeParse(
            convertHeaderToObj(request.headers),
        )
        if (!head.success) return errorResponseFromStatus(400)

        const { session } = locals
        if (!session) return errorResponseFromStatus(401)

        const result = await createSchedule({ did: session.did, request })
        if (!result.ok) {
            return result.code
                ? codeErrorResponse(result.status, result.code)
                : errorResponseFromStatus(result.status)
        }

        const res: PostSchema.ResponseBody200Type = result.value
        return jsonResponse(res, { headers: { "cache-control": "no-store" } })
    } catch (err) {
        console.error("schedules POST: unexpected error", err)
        return errorResponseFromStatus(500)
    }
}

/**
 * GET /v2/schedules — 自分の予約を一覧する。
 */
export const GET: APIRoute = async ({ url, locals }) => {
    try {
        const { session } = locals
        if (!session) return errorResponseFromStatus(401)

        const query = GetSchema.QuerySchema.safeParse(
            Object.fromEntries(url.searchParams),
        )
        if (!query.success) return errorResponseFromStatus(400)

        const res: GetSchema.ResponseBody200Type = await listScheduleSummaries({
            did: session.did,
            query: query.data,
        })
        return jsonResponse(res, { headers: { "cache-control": "no-store" } })
    } catch (err) {
        console.error("schedules GET: unexpected error", err)
        return errorResponseFromStatus(500)
    }
}
