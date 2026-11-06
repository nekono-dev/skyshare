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

/**
 * Skyshare v2 schedules/credential API（予約用の認証情報）。
 *
 * - GET: 登録の有無・再度の許可の要否・更新時刻・許可の有効期限の目安を返す（トークンは返さない）。
 *   同じ内容を登録状態のヒント cookie に保存し、クライアントが次の表示から D1 へ問い合わせずに済むようにする。
 * - 登録は OAuth の認可（`credential/authorization`）で行う。
 * - DELETE: 待機中の予約と失敗の履歴をすべて削除してから、認可サーバーで更新用トークンを取り消し、
 *   認証情報を削除して予約投稿を無効にする。
 *   実行中の予約があるときは何もせず 409（ScheduleRunning）を返す。
 *
 * 判断は `lib/schedule/scheduleCredential` の関数が行う。このファイルは認証の確認と、結果の HTTP への変換だけを行う。
 */

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
