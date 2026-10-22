import type { APIRoute } from "astro"

import { errorResponseFromStatus } from "@/lib/api/response.js"
import { convertHeaderToObj } from "@/util/http"
import * as PostSchema from "@/lib/api/schema/v2/schedules/post"
import * as GetSchema from "@/lib/api/schema/v2/schedules/get"
import { getScheduleEnv } from "@/lib/schedule/env"
import { removeImages } from "@/lib/schedule/imageStaging"
import {
    codeErrorResponse,
    jsonResponse,
    toIso,
} from "@/lib/schedule/scheduleResponse"
import { parseScheduleBody, stageSchedule } from "@/lib/schedule/stageSchedule"
import { insertSchedule, listSchedules } from "@/lib/schedule/store"
import type { StoredPayload } from "@/lib/schedule/validateSchedule"

/**
 * Skyshare v2 schedules API（予約の作成と一覧）。
 *
 * 責務と処理概要:
 * - POST: 投稿（1件、またはスレッド）を、実行時刻を指定して予約する。画像は R2 へ一時保管し、
 *   本文は D1 へ保存する。投稿の実行は定期実行（Cron Trigger）が行う。
 * - GET: 自分の予約を実行時刻の昇順で一覧する。
 * - 入力不正は 400、未認証は 401、予約用の認証情報が未登録なら 409、
 *   待機中の予約が上限なら 429、保管の失敗は 500 を返す。
 *
 * 実装上の制約:
 * - `@atproto/*` を静的にも動的にも読み込まない（無料枠の CPU 時間を守るため）。
 */

const PREVIEW_LENGTH = 100

/**
 * POST /v2/schedules — 予約を作成する。
 *
 * 検証の順序: 入力 → 実行時刻 → 認証情報の登録 → 待機中の件数 → 画像の保管 → 予約の保存
 * （入力から画像の保管までは `stageSchedule` が行う）。保存が失敗したときは、保管した画像を削除する。
 */
export const POST: APIRoute = async ({ request, locals }) => {
    try {
        const head = PostSchema.RequestHeaderSchema.safeParse(
            convertHeaderToObj(request.headers),
        )
        if (!head.success) return errorResponseFromStatus(400)

        const { session } = locals
        if (!session) return errorResponseFromStatus(401)

        const body = await parseScheduleBody(request, session.did)
        if (!body) return errorResponseFromStatus(400)

        const now = Math.floor(Date.now() / 1000)
        const env = await getScheduleEnv()
        const id = crypto.randomUUID()
        const staged = await stageSchedule(env, session.did, id, body, now, {
            countPending: true,
        })
        if (!staged.ok) {
            return staged.error
                ? codeErrorResponse(staged.status, staged.error)
                : errorResponseFromStatus(staged.status)
        }
        try {
            await insertSchedule(env.DB, {
                id,
                did: session.did,
                runAt: staged.runAt,
                payload: staged.payload,
                imageKeys: staged.imageKeys,
                now,
            })
        } catch (err) {
            console.error("schedules POST: insertSchedule failed", err)
            await removeImages(env.SCHEDULE_IMAGES, staged.imageKeys).catch(
                () => {},
            )
            return errorResponseFromStatus(500)
        }

        const res: PostSchema.ResponseBody200Type = {
            id,
            runAt: toIso(staged.runAt),
        }
        return jsonResponse(res)
    } catch (err) {
        console.error("schedules POST: unexpected error", err)
        return errorResponseFromStatus(500)
    }
}

/**
 * GET /v2/schedules — 自分の予約を一覧する。
 */
export const GET: APIRoute = async ({ url, locals }) => {
    try {
        const { session } = locals
        if (!session) return errorResponseFromStatus(401)

        const query = GetSchema.QuerySchema.safeParse(
            Object.fromEntries(url.searchParams),
        )
        if (!query.success) return errorResponseFromStatus(400)

        const env = await getScheduleEnv()
        const { items, cursor } = await listSchedules(env.DB, session.did, {
            status: query.data.status,
            limit: query.data.limit,
            cursor: query.data.cursor,
        })

        const res: GetSchema.ResponseBody200Type = {
            items: items.map(row => {
                let payload: StoredPayload = { posts: [] }
                try {
                    payload = JSON.parse(row.payload)
                } catch {
                    // 壊れた本文は空の表示にする
                }
                return {
                    id: row.id,
                    runAt: toIso(row.runAt),
                    status: row.status,
                    postCount: payload.posts.length,
                    preview: (payload.posts[0]?.text ?? "").slice(
                        0,
                        PREVIEW_LENGTH,
                    ),
                    lastError: row.lastError,
                }
            }),
            ...(cursor ? { cursor } : {}),
        }
        return jsonResponse(res)
    } catch (err) {
        console.error("schedules GET: unexpected error", err)
        return errorResponseFromStatus(500)
    }
}
