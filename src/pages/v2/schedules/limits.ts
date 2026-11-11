/**
 * 予約作成で使う制限値を返す API。
 *
 * - 応答値は作成時の検証が参照する定数と同じ値。
 */
import type { APIRoute } from "astro"

import { errorResponseFromStatus, jsonResponse } from "@/util/http"
import { getScheduleLimits } from "@/lib/schedule/validateSchedule"

export const GET: APIRoute = async ({ locals }) => {
    if (!locals.session) return errorResponseFromStatus(401)
    return jsonResponse(getScheduleLimits(), {
        headers: { "cache-control": "no-store" },
    })
}
