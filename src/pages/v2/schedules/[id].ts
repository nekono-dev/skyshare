import type { APIRoute } from "astro"

import { errorResponseFromStatus } from "@/lib/api/response.js"
import { convertHeaderToObj } from "@/util/http"
import * as DeleteSchema from "@/lib/api/schema/v2/schedules/_id/delete"
import * as GetSchema from "@/lib/api/schema/v2/schedules/_id/get"
import * as PutSchema from "@/lib/api/schema/v2/schedules/_id/put"
import { getScheduleEnv } from "@/lib/schedule/env"
import { removeImages } from "@/lib/schedule/imageStaging"
import {
    codeErrorResponse,
    jsonResponse,
    toIso,
} from "@/lib/schedule/scheduleResponse"
import { parseScheduleBody, stageSchedule } from "@/lib/schedule/stageSchedule"
import {
    deleteSchedule,
    getSchedule,
    parseKeys,
    updatePendingSchedule,
} from "@/lib/schedule/store"
import type { StoredPayload } from "@/lib/schedule/validateSchedule"

/**
 * Skyshare v2 schedules/{id} API（1件の予約）。
 *
 * 責務と処理概要:
 * - GET: 自分の待機中または失敗の予約の内容を、フォームへの書き戻しのために返す（画像は番号だけ）。
 * - PUT: 自分の待機中の予約を、作成と同じ入力で実行時刻・内容・画像ごと置き換える。
 * - DELETE: 待機中の予約を取り消す。失敗の予約は履歴として削除する。
 * - 他のアカウントの予約と存在しない予約は 404、実行中の予約は 409（ScheduleRunning）を返す。
 *
 * 実装上の制約:
 * - `@atproto/*` を静的にも動的にも読み込まない（無料枠の CPU 時間を守るため）。
 */

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

        const env = await getScheduleEnv()
        const row = await getSchedule(env.DB, session.did, path.data.id)
        if (!row) return errorResponseFromStatus(404)
        if (row.status === "running") {
            return codeErrorResponse(409, "ScheduleRunning")
        }
        // 待機中と失敗だけが内容を返せる（成功した予約は履歴に残さない）
        if (row.status !== "pending" && row.status !== "failed") {
            return errorResponseFromStatus(404)
        }

        let payload: StoredPayload = { posts: [] }
        try {
            payload = JSON.parse(row.payload)
        } catch {
            return errorResponseFromStatus(500)
        }
        const res: GetSchema.ResponseBody200Type = {
            id: row.id,
            status: row.status,
            runAt: toIso(row.runAt),
            posts: payload.posts.map(post => {
                // facets は返さない。分割代入で取り除く
                const { facets: _facets, ...rest } = post
                return rest as GetSchema.ResponseBody200Type["posts"][number]
            }),
            ...(payload.reply
                ? {
                      reply: payload.reply as GetSchema.ResponseBody200Type["reply"],
                  }
                : {}),
            ...(payload.createEntry !== undefined
                ? { createEntry: payload.createEntry }
                : {}),
            ...(payload.visual !== undefined ? { visual: payload.visual } : {}),
            ...(payload.heading !== undefined
                ? { heading: payload.heading }
                : {}),
            ...(payload.caption !== undefined
                ? { caption: payload.caption }
                : {}),
        }
        return jsonResponse(res)
    } catch (err) {
        console.error("schedules GET {id}: unexpected error", err)
        return errorResponseFromStatus(500)
    }
}

/**
 * PUT /v2/schedules/{id} — 待機中の予約を置き換える。
 *
 * 処理の順序:
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

        const env = await getScheduleEnv()
        const id = path.data.id
        const current = await getSchedule(env.DB, session.did, id)
        if (!current) return errorResponseFromStatus(404)
        if (current.status === "running") {
            return codeErrorResponse(409, "ScheduleRunning")
        }
        if (current.status !== "pending") return errorResponseFromStatus(404)

        const body = await parseScheduleBody(request, session.did)
        if (!body) return errorResponseFromStatus(400)

        const now = Math.floor(Date.now() / 1000)
        const staged = await stageSchedule(env, session.did, id, body, now, {
            countPending: false,
        })
        if (!staged.ok) {
            return staged.error
                ? codeErrorResponse(staged.status, staged.error)
                : errorResponseFromStatus(staged.status)
        }

        const replaced = await updatePendingSchedule(
            env.DB,
            session.did,
            id,
            {
                runAt: staged.runAt,
                payload: staged.payload,
                imageKeys: staged.imageKeys,
            },
            now,
        ).catch(async err => {
            console.error(`schedules PUT: update failed id=${id}`, err)
            await removeImages(env.SCHEDULE_IMAGES, staged.imageKeys).catch(
                () => {},
            )
            throw err
        })
        if (!replaced) {
            await removeImages(env.SCHEDULE_IMAGES, staged.imageKeys).catch(
                () => {},
            )
            return codeErrorResponse(409, "ScheduleRunning")
        }
        try {
            await removeImages(env.SCHEDULE_IMAGES, replaced.previousImageKeys)
        } catch (err) {
            console.error(`schedules PUT: removeImages failed id=${id}`, err)
        }

        const res: PutSchema.ResponseBody200Type = {
            id,
            runAt: toIso(staged.runAt),
        }
        return jsonResponse(res)
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
                parseKeys(deleted.imageKeys),
            )
        } catch (err) {
            console.error("schedules DELETE: removeImages failed", err)
        }
        return jsonResponse({})
    } catch (err) {
        console.error("schedules DELETE: unexpected error", err)
        return errorResponseFromStatus(500)
    }
}
