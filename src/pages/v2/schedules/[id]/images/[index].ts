import type { APIRoute } from "astro"

import { errorResponseFromStatus } from "@/lib/api/response.js"
import * as GetSchema from "@/lib/api/schema/v2/schedules/_id/images/_index/get"
import { getScheduleEnv } from "@/lib/schedule/env"
import { getImage } from "@/lib/schedule/imageStaging"
import { codeErrorResponse } from "@/lib/schedule/scheduleResponse"
import { getSchedule, parseKeys } from "@/lib/schedule/store"

/**
 * GET /v2/schedules/{id}/images/{index} — 自分の待機中または失敗の予約に添付した画像を番号で返す。
 *
 * 責務と処理概要:
 * - 予約の編集で、投稿フォームへ画像を書き戻すために使う。
 * - 他のアカウントの予約・存在しない予約・待機中でも失敗でもない予約・範囲外の番号は 404、実行中の予約は 409。
 * - 応答の content-type は保管時の値とし、キャッシュを禁止する。
 *
 * 実装上の制約:
 * - `@atproto/*` を静的にも動的にも読み込まない（無料枠の CPU 時間を守るため）。
 */
export const GET: APIRoute = async ({ params, locals }) => {
    try {
        const { session } = locals
        if (!session) return errorResponseFromStatus(401)

        const path = GetSchema.PathParamsSchema.safeParse(params)
        if (!path.success) return errorResponseFromStatus(400)

        const env = await getScheduleEnv()
        const row = await getSchedule(env.DB, session.did, path.data.id)
        if (!row) return errorResponseFromStatus(404)
        if (row.status === "running") {
            return codeErrorResponse(409, "ScheduleRunning")
        }
        if (row.status !== "pending" && row.status !== "failed") {
            return errorResponseFromStatus(404)
        }

        const image = await getImage(
            env.SCHEDULE_IMAGES,
            session.did,
            parseKeys(row.imageKeys),
            path.data.index,
        )
        if (!image) return errorResponseFromStatus(404)
        return new Response(image.bytes, {
            status: 200,
            headers: {
                "content-type": image.mime,
                "cache-control": "no-store",
            },
        })
    } catch (err) {
        console.error("schedules images GET: unexpected error", err)
        return errorResponseFromStatus(500)
    }
}
