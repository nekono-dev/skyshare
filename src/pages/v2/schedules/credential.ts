import type { APIRoute } from "astro"

import { errorResponseFromStatus } from "@/lib/api/response.js"
import { getScheduleEnv } from "@/lib/schedule/env"
import {
    makeScheduleHintClearCookie,
    makeScheduleHintSetCookie,
} from "@/lib/schedule/availabilityHint"
import { estimateCredentialExpiry } from "@/lib/schedule/credentialExpiry"
import { parseCredential } from "@/lib/schedule/oauth/storedCredential"
import { revokeCredential } from "@/lib/schedule/oauth/flow"
import {
    codeErrorResponse,
    jsonResponse,
    toIso,
} from "@/lib/schedule/scheduleResponse"
import * as DeleteSchema from "@/lib/api/schema/v2/schedules/credential/delete"
import { removeImages } from "@/lib/schedule/imageStaging"
import {
    deleteCredential,
    deleteSchedulesExceptRunning,
    getCredentialStatus,
    loadCredential,
    listSchedules,
    parseKeys,
} from "@/lib/schedule/store"

/**
 * Skyshare v2 schedules/credential API（予約用の認証情報）。
 *
 * - GET: 登録の有無・再度の許可の要否・更新時刻・許可の有効期限の目安を返す（トークンは返さない）。
 *   同じ内容を登録状態のヒント cookie に保存し、クライアントが次の表示から D1 へ問い合わせずに済むようにする。
 * - 登録は OAuth の認可（`credential/authorization`）で行う。
 * - DELETE: 待機中の予約と失敗の履歴をすべて削除してから、認可サーバーで更新用トークンを取り消し、
 *   認証情報を削除して予約投稿を無効にする。
 *   実行中の予約があるときは何もせず 409（ScheduleRunning）を返す。
 */

export const GET: APIRoute = async ({ locals }) => {
    try {
        const { session } = locals
        if (!session) return errorResponseFromStatus(401)
        const env = await getScheduleEnv()
        const status = await getCredentialStatus(env.DB, session.did)
        if (!status.registered) {
            return jsonResponse(
                { registered: false, reauthRequired: false },
                200,
                [
                    makeScheduleHintSetCookie({
                        registered: false,
                        reauthRequired: false,
                    }),
                ],
            )
        }
        const expiresAt = status.reauthRequired
            ? undefined
            : toIso(estimateCredentialExpiry(status))
        return jsonResponse(
            {
                registered: true,
                reauthRequired: status.reauthRequired,
                updatedAt: toIso(status.updatedAt),
                ...(expiresAt === undefined ? {} : { expiresAt }),
            },
            200,
            [
                makeScheduleHintSetCookie({
                    registered: true,
                    reauthRequired: status.reauthRequired,
                    ...(expiresAt === undefined ? {} : { expiresAt }),
                }),
            ],
        )
    } catch (err) {
        console.error("schedule credential GET: unexpected error", err)
        return errorResponseFromStatus(500)
    }
}

/**
 * DELETE /v2/schedules/credential — 予約投稿を無効にする。
 *
 * 処理の順序:
 * 1. 実行中の予約があれば、実行を止めずに認証情報だけが消えるのを防ぐため 409 を返す。
 * 2. 待機中と失敗の予約を一括で削除し、それぞれの画像を削除する（画像の削除の失敗は記録だけする）。
 * 3. 認可サーバーで更新用トークンを取り消す（失敗しても続ける）。
 * 4. 認証情報を削除し、取り消した待機中の件数と削除した失敗の件数を返す。
 *    登録が無くても 200 を返す（冪等）。登録状態のヒント cookie は失効させる。
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
        const deleted = await deleteSchedulesExceptRunning(env.DB, session.did)
        for (const row of deleted) {
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
        const stored = await loadCredential(
            env.DB,
            env.SCHEDULE_ENC_KEY,
            session.did,
        ).catch(() => null)
        const credential = stored ? parseCredential(stored.token) : null
        if (credential) {
            await revokeCredential(
                env,
                credential,
                Math.floor(Date.now() / 1000),
            )
        }
        await deleteCredential(env.DB, session.did)
        const res: DeleteSchema.ResponseBody200Type = {
            registered: false,
            cancelled: deleted.filter(r => r.status === "pending").length,
            deletedHistory: deleted.filter(r => r.status === "failed").length,
        }
        return jsonResponse(res, 200, [makeScheduleHintClearCookie()])
    } catch (err) {
        console.error("schedule credential DELETE: unexpected error", err)
        return errorResponseFromStatus(500)
    }
}
