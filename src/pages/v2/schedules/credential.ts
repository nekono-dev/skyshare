import type { APIRoute } from "astro"

import { errorResponseFromStatus } from "@/lib/api/response.js"
import * as PutSchema from "@/lib/api/schema/v2/schedules/credential/put"
import { getScheduleEnv } from "@/lib/schedule/env"
import { registerScheduleCredential } from "@/lib/schedule/registerCredential"
import {
    codeErrorResponse,
    jsonResponse,
    toIso,
} from "@/lib/schedule/scheduleResponse"
import * as DeleteSchema from "@/lib/api/schema/v2/schedules/credential/delete"
import { removeImages } from "@/lib/schedule/imageStaging"
import {
    deleteCredential,
    deletePendingSchedules,
    getCredentialStatus,
    listSchedules,
    parseKeys,
} from "@/lib/schedule/store"

/**
 * Skyshare v2 schedules/credential API（予約用の認証情報）。
 *
 * - GET: 登録の有無と更新時刻を返す（トークンは返さない）。
 * - PUT: アプリパスワードでログインし、更新用トークンを暗号化して登録する。
 *   パスワードはどこにも保管せず、ログにも出力しない。
 * - DELETE: 待機中の予約をすべて取り消してから認証情報を削除し、予約投稿を無効にする。
 *   実行中の予約があるときは何もせず 409（ScheduleRunning）を返す。
 */

export const GET: APIRoute = async ({ locals }) => {
    try {
        const { session } = locals
        if (!session) return errorResponseFromStatus(401)
        const env = await getScheduleEnv()
        const status = await getCredentialStatus(env.DB, session.did)
        return jsonResponse({
            registered: status.registered,
            ...(status.updatedAt ? { updatedAt: toIso(status.updatedAt) } : {}),
        })
    } catch (err) {
        console.error("schedule credential GET: unexpected error", err)
        return errorResponseFromStatus(500)
    }
}

export const PUT: APIRoute = async ({ request, locals }) => {
    try {
        const { session, service } = locals
        if (!session || !service) return errorResponseFromStatus(401)

        let json: unknown
        try {
            json = await request.json()
        } catch {
            return errorResponseFromStatus(400)
        }
        const body = PutSchema.RequestBodySchema.safeParse(json)
        if (!body.success) return errorResponseFromStatus(400)

        const env = await getScheduleEnv()
        const result = await registerScheduleCredential(
            env.DB,
            env.SCHEDULE_ENC_KEY,
            { did: session.did, service },
            body.data.password,
            Math.floor(Date.now() / 1000),
        )
        if (!result.ok) return errorResponseFromStatus(result.status)
        return jsonResponse({ registered: true })
    } catch {
        // パスワードを含みうる例外の内容は出力しない
        console.error("schedule credential PUT: unexpected error")
        return errorResponseFromStatus(500)
    }
}

/**
 * DELETE /v2/schedules/credential — 予約投稿を無効にする。
 *
 * 処理の順序:
 * 1. 実行中の予約があれば、実行を止めずに認証情報だけが消えるのを防ぐため 409 を返す。
 * 2. 待機中の予約を一括で削除し、それぞれの画像を削除する（画像の削除の失敗は記録だけする）。
 * 3. 認証情報を削除し、取り消した件数を返す。登録が無くても 200 を返す（冪等）。
 */
export const DELETE: APIRoute = async ({ locals }) => {
    try {
        const { session } = locals
        if (!session) return errorResponseFromStatus(401)
        const env = await getScheduleEnv()
        const running = await listSchedules(env.DB, session.did, {
            status: "running",
            limit: 1,
        })
        if (running.items.length > 0) {
            return codeErrorResponse(409, "ScheduleRunning")
        }
        const cancelled = await deletePendingSchedules(env.DB, session.did)
        for (const row of cancelled) {
            await removeImages(
                env.SCHEDULE_IMAGES,
                parseKeys(row.imageKeys),
            ).catch(err => {
                console.error(
                    `schedule credential DELETE: removeImages failed id=${row.id}`,
                    err,
                )
            })
        }
        await deleteCredential(env.DB, session.did)
        const res: DeleteSchema.ResponseBody200Type = {
            registered: false,
            cancelled: cancelled.length,
        }
        return jsonResponse(res)
    } catch (err) {
        console.error("schedule credential DELETE: unexpected error", err)
        return errorResponseFromStatus(500)
    }
}
