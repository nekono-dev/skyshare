import type { APIRoute } from "astro"

import { errorResponseFromStatus } from "@/lib/api/response.js"
import * as DeleteSchema from "@/lib/api/schema/v2/schedules/_id/delete"
import { getScheduleEnv } from "@/lib/schedule/env"
import { removeImages } from "@/lib/schedule/imageStaging"
import {
    codeErrorResponse,
    jsonResponse,
} from "@/lib/schedule/scheduleResponse"
import {
    deleteSchedule,
    getSchedule,
    purgeIdleCredential,
} from "@/lib/schedule/store"

/**
 * DELETE /v2/schedules/{id} — 待機中の予約を取り消す。投稿済み・失敗の予約は履歴として削除する。
 *
 * - 他のアカウントの予約と存在しない予約は 404。
 * - 実行中の予約は削除せず 409（ScheduleRunning）。
 * - 待機中の予約を取り消したら、保管した画像を削除し、
 *   待機中も実行中もなくなったアカウントの認証情報を削除する。
 */
export const DELETE: APIRoute = async ({ params, locals }) => {
    try {
        const { session } = locals
        if (!session) return errorResponseFromStatus(401)

        const path = DeleteSchema.PathParamsSchema.safeParse(params)
        if (!path.success) return errorResponseFromStatus(400)

        const env = await getScheduleEnv()
        const current = await getSchedule(env.DB, session.did, path.data.id)
        if (!current) return errorResponseFromStatus(404)
        if (current.status === "running") {
            return codeErrorResponse(409, "ScheduleRunning")
        }

        // 確認と削除の間に実行が始まった場合は、削除せず null が返る
        const deleted = await deleteSchedule(env.DB, session.did, path.data.id)
        if (!deleted) return codeErrorResponse(409, "ScheduleRunning")

        try {
            await removeImages(
                env.SCHEDULE_IMAGES,
                JSON.parse(deleted.imageKeys),
            )
        } catch (err) {
            console.error("schedules DELETE: removeImages failed", err)
        }
        if (deleted.status === "pending") {
            await purgeIdleCredential(env.DB, session.did)
        }
        return jsonResponse({})
    } catch (err) {
        console.error("schedules DELETE: unexpected error", err)
        return errorResponseFromStatus(500)
    }
}
