/** 予約の作成と一覧取得のドメイン判断を行う。 */
import type { Outcome } from "@/types/outcome"
import { getScheduleEnv } from "@/lib/schedule/env"
import { removeImages } from "@/lib/schedule/imageStaging"
import { toIso } from "@/lib/schedule/scheduleResponse"
import { parseScheduleBody, stageSchedule } from "@/lib/schedule/stageSchedule"
import { insertSchedule, listSchedules } from "@/lib/schedule/store"
import type { ScheduleStatus } from "@/lib/schedule/types"
import type { StoredPayload } from "@/lib/schedule/validateSchedule"

/** 一覧のプレビューの最大の文字数 */
const PREVIEW_LENGTH = 100

/** 予約の作成の応答の本体（`id` と実行時刻の ISO 文字列） */
export type ScheduleCreatedDto = {
    id: string
    runAt: string
}

/** 予約の一覧の 1 件の応答の本体 */
export type ScheduleSummaryDto = {
    id: string
    runAt: string
    status: ScheduleStatus
    postCount: number
    preview: string
    lastError: string | null
}

/** 予約の一覧の応答の本体。続きがあるときだけ cursor を持つ */
export type ScheduleListDto = {
    items: ScheduleSummaryDto[]
    cursor?: string
}

/**
 * 予約を 1 件作成する。
 *
 * 検証の順序: 入力 → 実行時刻 → 認証情報の登録 → 待機中の件数 → 画像の保管 → 予約の保存
 * （入力から画像の保管までは `stageSchedule` が行う）。保存が失敗したときは、保管した画像を削除する。
 *
 * Input:
 * - `did`: セッションのアカウント
 * - `request`: リクエスト（multipart の本文を読む）
 *
 * Output:
 * - 成功: `{ ok: true, value: { id, runAt } }`（`runAt` は ISO 文字列）
 * - 失敗: 400（入力の不正）・409（認証情報の未登録・再認可）・429（待機中の上限）・500（保管・保存の失敗）。
 *   `code` は現行の応答の `error` に入る値
 *
 * Example: `const result = await createSchedule({ did: session.did, request })`
 */
export const createSchedule = async (input: {
    did: string
    request: Request
}): Promise<Outcome<ScheduleCreatedDto>> => {
    const { did, request } = input
    const body = await parseScheduleBody(request, did)
    if (!body) return { ok: false, status: 400 }

    const now = Math.floor(Date.now() / 1000)
    const env = await getScheduleEnv()
    const id = crypto.randomUUID()
    const staged = await stageSchedule(env, did, id, body, now, {
        countPending: true,
    })
    if (!staged.ok) {
        return staged.error
            ? { ok: false, status: staged.status, code: staged.error }
            : { ok: false, status: staged.status }
    }
    try {
        await insertSchedule(env.DB, {
            id,
            did,
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
        return { ok: false, status: 500 }
    }

    return { ok: true, value: { id, runAt: toIso(staged.runAt) } }
}

/**
 * 自分の予約を一覧する（実行時刻の昇順）。
 *
 * Input:
 * - `did`: セッションのアカウント
 * - `query`: 状態の絞り込み・件数・続きの cursor（ページが検証済みの値）
 *
 * Output: 応答の本体。壊れた本文は空の本文として扱い、プレビューは先頭の本文の先頭 100 文字
 *
 * Example: `const res = await listScheduleSummaries({ did, query: query.data })`
 */
export const listScheduleSummaries = async (input: {
    did: string
    query: { status?: ScheduleStatus; limit?: number; cursor?: string }
}): Promise<ScheduleListDto> => {
    const env = await getScheduleEnv()
    const { items, cursor } = await listSchedules(env.DB, input.did, {
        status: input.query.status,
        limit: input.query.limit ?? 20,
        cursor: input.query.cursor,
    })

    return {
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
}
