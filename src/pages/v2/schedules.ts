import type { APIRoute } from "astro"

import { errorResponseFromStatus } from "@/lib/api/response.js"
import { convertHeaderToObj, isMultipartFormData } from "@/util/http"
import { formDataToObject } from "@/util/formData"
import { validateFacets } from "@/lib/atproto/facet"
import { validateImageMetadata } from "@/lib/atproto/embed"
import { isReplyRefOwnedBySelf } from "@/lib/atproto/post"
import * as PostSchema from "@/lib/api/schema/v2/schedules/post"
import * as GetSchema from "@/lib/api/schema/v2/schedules/get"
import { getScheduleEnv } from "@/lib/schedule/env"
import { MAX_PENDING_PER_ACCOUNT } from "@/lib/schedule/scheduleLimits"
import { putImages, removeImages } from "@/lib/schedule/imageStaging"
import {
    codeErrorResponse,
    jsonResponse,
    toIso,
} from "@/lib/schedule/scheduleResponse"
import {
    countPending,
    getCredentialStatus,
    insertSchedule,
    listSchedules,
} from "@/lib/schedule/store"
import { MAX_IMAGE_BYTES_PER_SCHEDULE } from "@/lib/schedule/types"
import { toStoredPayload, validateRunAt } from "@/lib/schedule/validateSchedule"
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
 * 検証の順序: 入力 → 実行時刻 → 認証情報の登録 → 待機中の件数 → 画像の保管 → 予約の保存。
 * 画像の保管後に保存が失敗したときは、保管した画像を削除する。
 */
export const POST: APIRoute = async ({ request, locals }) => {
    try {
        const head = PostSchema.RequestHeaderSchema.safeParse(
            convertHeaderToObj(request.headers),
        )
        if (!head.success) return errorResponseFromStatus(400)

        const { session } = locals
        if (!session) return errorResponseFromStatus(401)

        if (!isMultipartFormData(request.headers.get("content-type"))) {
            return errorResponseFromStatus(400)
        }
        let formData: FormData
        try {
            formData = await request.formData()
        } catch {
            return errorResponseFromStatus(400)
        }

        const raw = formDataToObject(formData, PostSchema.RequestBodyFieldKinds)
        if (Array.isArray(raw.posts)) {
            for (const item of raw.posts as Record<string, unknown>[]) {
                if (
                    typeof item.text === "string" &&
                    item.text.trim().length === 0
                ) {
                    delete item.text
                }
            }
        }
        const body = PostSchema.RequestBodySchema.safeParse(raw)
        if (!body.success) return errorResponseFromStatus(400)

        // 投稿内容の検証（投稿の作成と同じ規則）
        if (!isReplyRefOwnedBySelf(body.data.reply, session.did)) {
            return errorResponseFromStatus(400)
        }
        if (body.data.createEntry === true && !body.data.visual) {
            return errorResponseFromStatus(400)
        }
        for (const item of body.data.posts) {
            const images = "images" in item ? item.images : undefined
            const imagesMeta =
                "imagesMeta" in item ? item.imagesMeta : undefined
            try {
                validateImageMetadata(images, imagesMeta)
                validateFacets(item.text ?? "", item.facets)
            } catch {
                return errorResponseFromStatus(400)
            }
        }

        const now = Math.floor(Date.now() / 1000)
        const runAt = validateRunAt(body.data.runAt, now)
        if (!runAt.ok) return errorResponseFromStatus(400)

        const env = await getScheduleEnv()
        const credential = await getCredentialStatus(env.DB, session.did)
        if (!credential.registered) {
            return codeErrorResponse(409, "ScheduleCredentialRequired")
        }
        if (
            (await countPending(env.DB, session.did)) >= MAX_PENDING_PER_ACCOUNT
        ) {
            return errorResponseFromStatus(429)
        }

        const { payload, images } = await toStoredPayload(body.data)
        const total = images.reduce((sum, img) => sum + img.bytes.byteLength, 0)
        if (total > MAX_IMAGE_BYTES_PER_SCHEDULE) {
            return errorResponseFromStatus(400)
        }

        const id = crypto.randomUUID()
        let keys: string[]
        try {
            keys = await putImages(env.SCHEDULE_IMAGES, session.did, id, images)
        } catch (err) {
            console.error("schedules POST: putImages failed", err)
            return errorResponseFromStatus(500)
        }
        try {
            await insertSchedule(env.DB, {
                id,
                did: session.did,
                runAt: runAt.epoch,
                payload: JSON.stringify(payload),
                imageKeys: keys,
                now,
            })
        } catch (err) {
            console.error("schedules POST: insertSchedule failed", err)
            await removeImages(env.SCHEDULE_IMAGES, keys).catch(() => {})
            return errorResponseFromStatus(500)
        }

        const res: PostSchema.ResponseBody200Type = {
            id,
            runAt: toIso(runAt.epoch),
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
                    resultUri: row.resultUri,
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
