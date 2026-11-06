import type { APIRoute } from "astro"

import { errorResponseFromStatus } from "@/util/http"
import * as GetSchema from "@/lib/api/schema/v2/schedules/[id]/images/[index]/get"
import { codeErrorResponse } from "@/lib/schedule/scheduleResponse"
import { getScheduleImage } from "@/lib/schedule/scheduleImage"

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

        const result = await getScheduleImage({
            did: session.did,
            id: path.data.id,
            index: path.data.index,
        })
        if (!result.ok) {
            return result.code
                ? codeErrorResponse(result.status, result.code)
                : errorResponseFromStatus(result.status)
        }
        return new Response(result.value.bytes, {
            status: 200,
            headers: {
                "content-type": result.value.mime,
                "cache-control": "no-store",
            },
        })
    } catch (err) {
        console.error("schedules images GET: unexpected error", err)
        return errorResponseFromStatus(500)
    }
}
