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
import { getCredentialStatus, purgeIdleCredential } from "@/lib/schedule/store"

/**
 * Skyshare v2 schedules/credential API（予約用の認証情報）。
 *
 * - GET: 登録の有無と更新時刻を返す（トークンは返さない）。
 * - PUT: アプリパスワードでログインし、更新用トークンを暗号化して登録する。
 *   パスワードはどこにも保管せず、ログにも出力しない。
 * - DELETE: 待機中も実行中の予約もないときだけ削除する（409: ScheduleCredentialInUse）。
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

export const DELETE: APIRoute = async ({ locals }) => {
    try {
        const { session } = locals
        if (!session) return errorResponseFromStatus(401)
        const env = await getScheduleEnv()
        const status = await getCredentialStatus(env.DB, session.did)
        if (status.registered) {
            const deleted = await purgeIdleCredential(env.DB, session.did)
            if (!deleted)
                return codeErrorResponse(409, "ScheduleCredentialInUse")
        }
        return jsonResponse({ registered: false })
    } catch (err) {
        console.error("schedule credential DELETE: unexpected error", err)
        return errorResponseFromStatus(500)
    }
}
