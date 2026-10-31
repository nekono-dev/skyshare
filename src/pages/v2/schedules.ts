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
 * Skyshare v2 schedules API（予約の作成と一覧）。
 *
 * 責務と処理概要:
 * - POST: 投稿（1件、またはスレッド）を、実行時刻を指定して予約する。画像は R2 へ一時保管し、
 *   本文は D1 へ保存する。投稿の実行は定期実行（Cron Trigger）が行う。
 * - GET: 自分の予約を実行時刻の昇順で一覧する。
 * - 入力不正は 400、未認証は 401、予約用の認証情報が未登録なら 409、
 *   待機中の予約が上限なら 429、保管の失敗は 500 を返す。
 *
 * 実装上の制約:
 * - `@atproto/*` を静的にも動的にも読み込まない（無料枠の CPU 時間を守るため）。
 * - ページは判断を持たない。ヘッダー・セッション・クエリの確認と、判断の結果の応答への変換だけを行う。
 */

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
