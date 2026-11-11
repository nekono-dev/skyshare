/**
 * 予約投稿の認証情報の状態取得と無効化 API。
 *
 * - 状態応答にトークンを含めず、キャッシュを禁止する。
 * - 無効化は実行中の予約があれば何も削除せず 409 を返す。
 */
import type { APIRoute } from "astro"

import { errorResponseFromStatus, jsonResponse } from "@/util/http"
import {
    makeScheduleHintClearCookie,
    makeScheduleHintSetCookie,
} from "@/lib/schedule/availabilityHint"
import { codeErrorResponse } from "@/lib/schedule/scheduleResponse"
import * as DeleteSchema from "@/lib/api/schema/v2/schedules/credential/delete"
import {
    disableScheduling,
    getCredentialState,
} from "@/lib/schedule/scheduleCredential"

export const GET: APIRoute = async ({ locals }) => {
    try {
        const { session } = locals
        if (!session) return errorResponseFromStatus(401)
        const { body, hint } = await getCredentialState({ did: session.did })
        return jsonResponse(body, {
            headers: [
                ["cache-control", "no-store"],
                ["set-cookie", makeScheduleHintSetCookie(hint)],
            ],
        })
    } catch (err) {
        console.error("schedule credential GET: unexpected error", err)
        return errorResponseFromStatus(500)
    }
}

/**
 * DELETE /v2/schedules/credential — 予約投稿を無効にする。
 *
 * 判断の順序と応答は `disableScheduling` を参照する。
 * 登録が無くても 200 を返す（冪等）。登録状態のヒント cookie は失効させる。
 */
export const DELETE: APIRoute = async ({ locals }) => {
    try {
        const { session } = locals
        if (!session) return errorResponseFromStatus(401)
        const result = await disableScheduling({ did: session.did })
        if (!result.ok) {
            if (result.code) {
                return codeErrorResponse(result.status, result.code)
            }
            return errorResponseFromStatus(result.status)
        }
        const res: DeleteSchema.ResponseBody200Type = {
            registered: false,
            cancelled: result.value.cancelled,
            deletedHistory: result.value.deletedHistory,
        }
        return jsonResponse(res, {
            headers: [
                ["cache-control", "no-store"],
                ["set-cookie", makeScheduleHintClearCookie()],
            ],
        })
    } catch (err) {
        console.error("schedule credential DELETE: unexpected error", err)
        return errorResponseFromStatus(500)
    }
}
