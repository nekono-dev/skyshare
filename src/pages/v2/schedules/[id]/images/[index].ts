/**
 * 予約の編集画面へ画像を戻す API。
 *
 * - 自分の待機中または失敗の予約だけを対象にし、該当しない予約は 404、実行中は 409。
 * - 保管時の content-type を返し、キャッシュを禁止する。
 * - `@atproto/*` を読み込まず、無料枠の CPU 時間を抑える。
 */
import type { APIRoute } from "astro"

import { errorResponseFromStatus } from "@/util/http"
import * as GetSchema from "@/lib/api/schema/v2/schedules/[id]/images/[index]/get"
import { codeErrorResponse } from "@/lib/schedule/scheduleResponse"
import { getScheduleImage } from "@/lib/schedule/scheduleImage"

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
