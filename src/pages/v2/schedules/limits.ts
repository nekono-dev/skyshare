import type { APIRoute } from "astro"

import { errorResponseFromStatus } from "@/lib/api/response.js"
import { jsonResponse } from "@/lib/schedule/scheduleResponse"
import { getScheduleLimits } from "@/lib/schedule/validateSchedule"

/**
 * GET /v2/schedules/limits — 予約の制限値を返す。
 * 値は作成の検証が参照する定数そのもの。画面はこの値に従う。
 */
export const GET: APIRoute = async ({ locals }) => {
    if (!locals.session) return errorResponseFromStatus(401)
    return jsonResponse(getScheduleLimits())
}
