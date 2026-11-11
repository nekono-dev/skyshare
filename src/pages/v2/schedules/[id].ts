/**
 * 予約 1 件の取得・置き換え・取消 API。
 *
 * - `@atproto/*` を読み込まず、無料枠の CPU 時間を抑える。
 * - 他アカウントの予約は存在しない予約と同じ 404 で扱う。
 */
import type { APIRoute } from "astro"

import { errorResponseFromStatus, jsonResponse } from "@/util/http"
import { convertHeaderToObj } from "@/util/http"
import * as DeleteSchema from "@/lib/api/schema/v2/schedules/[id]/delete"
import * as GetSchema from "@/lib/api/schema/v2/schedules/[id]/get"
import * as PutSchema from "@/lib/api/schema/v2/schedules/[id]/put"
import { codeErrorResponse } from "@/lib/schedule/scheduleResponse"
import {
    cancelSchedule,
    getScheduleDetail,
    replaceSchedule,
} from "@/lib/schedule/scheduleItem"

/**
 * GET /v2/schedules/{id} — 待機中または失敗の予約の内容を返す。実行中は 409。
 * 保管した本文から facets を除いて返す（facets は画面側が送信の直前に検出し直す）。
 */
export const GET: APIRoute = async ({ params, locals }) => {
    try {
        const { session } = locals
        if (!session) return errorResponseFromStatus(401)

        const path = GetSchema.PathParamsSchema.safeParse(params)
        if (!path.success) return errorResponseFromStatus(400)

        const result = await getScheduleDetail({
            did: session.did,
            id: path.data.id,
        })
        if (!result.ok) {
            return result.code
                ? codeErrorResponse(result.status, result.code)
                : errorResponseFromStatus(result.status)
        }
        const res: GetSchema.ResponseBody200Type = result.value
        return jsonResponse(res, { headers: { "cache-control": "no-store" } })
    } catch (err) {
        console.error("schedules GET {id}: unexpected error", err)
        return errorResponseFromStatus(500)
    }
}

/**
 * PUT /v2/schedules/{id} — 待機中の予約を置き換える。
 *
 * 処理の順序（判断は `replaceSchedule` が行う）:
 * 1. 所有と状態の確認（他人・存在しない・終了済みは 404、実行中は 409）
 * 2. 作成と同じ検証と画像の保管（新しい世代のキーに書く）
 * 3. 待機中の行に限った置き換え。間に実行が始まっていたら、新しい画像を消して 409
 * 4. 置き換え前の画像の削除（失敗は記録だけし、ライフサイクルの削除に任せる）
 */
export const PUT: APIRoute = async ({ params, request, locals }) => {
    try {
        const head = PutSchema.RequestHeaderSchema.safeParse(
            convertHeaderToObj(request.headers),
        )
        if (!head.success) return errorResponseFromStatus(400)

        const { session } = locals
        if (!session) return errorResponseFromStatus(401)

        const path = PutSchema.PathParamsSchema.safeParse(params)
        if (!path.success) return errorResponseFromStatus(400)

        const result = await replaceSchedule({
            did: session.did,
            id: path.data.id,
            request,
        })
        if (!result.ok) {
            return result.code
                ? codeErrorResponse(result.status, result.code)
                : errorResponseFromStatus(result.status)
        }
        const res: PutSchema.ResponseBody200Type = result.value
        return jsonResponse(res, { headers: { "cache-control": "no-store" } })
    } catch (err) {
        console.error("schedules PUT: unexpected error", err)
        return errorResponseFromStatus(500)
    }
}

/**
 * DELETE /v2/schedules/{id} — 待機中の予約を取り消す。失敗の予約は履歴として削除する。
 * 保管した画像も削除する。認証情報は予約投稿を無効にするまで残す。
 */
export const DELETE: APIRoute = async ({ params, locals }) => {
    try {
        const { session } = locals
        if (!session) return errorResponseFromStatus(401)

        const path = DeleteSchema.PathParamsSchema.safeParse(params)
        if (!path.success) return errorResponseFromStatus(400)

        const result = await cancelSchedule({
            did: session.did,
            id: path.data.id,
        })
        if (!result.ok) {
            return result.code
                ? codeErrorResponse(result.status, result.code)
                : errorResponseFromStatus(result.status)
        }
        return jsonResponse({}, { headers: { "cache-control": "no-store" } })
    } catch (err) {
        console.error("schedules DELETE: unexpected error", err)
        return errorResponseFromStatus(500)
    }
}
