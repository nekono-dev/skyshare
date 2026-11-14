/** 予約 1 件の取得・置き換え・取り消しを扱う。 */
import type { Outcome } from "@/types/outcome"
import { getScheduleEnv } from "@/lib/schedule/env"
import { removeImages } from "@/lib/schedule/imageStaging"
import { toIso } from "@/lib/schedule/scheduleResponse"
import { parseScheduleBody, stageSchedule } from "@/lib/schedule/stageSchedule"
import {
    deleteSchedule,
    getSchedule,
    parseKeys,
    updatePendingSchedule,
} from "@/lib/schedule/store"
import type {
    BskyImagesMeta,
    BskyOgMeta,
    BskyReplyRef,
} from "@/lib/atproto/recordTypes"
import type { PostGateValue } from "@/lib/atproto/gate"
import type { StoredPayload } from "@/lib/schedule/validateSchedule"

/**
 * 予約の 1 投稿分の内容（保管した本文から facets を除いた形）。
 * 保管の時点で検証済みの値を、ドメインの型で表す。画像は番号で参照する。
 */
export type ScheduleDetailPostDto = {
    text?: string
    langs?: string[]
    selfLabels?: string
    gate?: PostGateValue
    ogMeta?: BskyOgMeta
    imagesMeta?: BskyImagesMeta
    images?: number[]
    ogImage?: number
}

/** 予約 1 件の内容の応答の本体（画像は番号だけ。facets は含まない） */
export type ScheduleDetailDto = {
    id: string
    status: "pending" | "failed"
    runAt: string
    posts: ScheduleDetailPostDto[]
    reply?: BskyReplyRef
    createEntry?: boolean
    visual?: number
    heading?: string
    caption?: string
}

/**
 * 待機中または失敗の予約の内容を取得する。
 *
 * 処理の順序: 行の所有 → 実行中（409）→ 待機中と失敗以外（404）→ 本文の読み取り（失敗は 500）→ 内容の組み立て。
 *
 * Input:
 * - `did`: セッションのアカウント
 * - `id`: 予約の識別子（ページが検証済み）
 *
 * Output:
 * - 成功: `{ ok: true, value: ScheduleDetailDto }`（`runAt` は ISO 文字列、`posts` は facets を除いた形）
 * - 失敗: 404（予約なし・対象外の状態）・409（実行中、`code` は ScheduleRunning）・500（本文が読めない）
 *
 * Example: `const result = await getScheduleDetail({ did: session.did, id: "s1" })`
 */
export const getScheduleDetail = async (input: {
    did: string
    id: string
}): Promise<Outcome<ScheduleDetailDto>> => {
    const env = await getScheduleEnv()
    const row = await getSchedule(env.DB, input.did, input.id)
    if (!row) return { ok: false, status: 404 }
    if (row.status === "running") {
        return { ok: false, status: 409, code: "ScheduleRunning" }
    }
    // 待機中と失敗だけが内容を返せる（成功した予約は履歴に残さない）
    if (row.status !== "pending" && row.status !== "failed") {
        return { ok: false, status: 404 }
    }

    let payload: StoredPayload = { posts: [] }
    try {
        payload = JSON.parse(row.payload)
    } catch {
        return { ok: false, status: 500 }
    }
    return {
        ok: true,
        value: {
            id: row.id,
            status: row.status,
            runAt: toIso(row.runAt),
            posts: payload.posts.map(post => {
                // facets は返さない。分割代入で取り除く
                const { facets: _facets, ...rest } = post
                return rest as ScheduleDetailPostDto
            }),
            ...(payload.reply ? { reply: payload.reply as BskyReplyRef } : {}),
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
        },
    }
}

/**
 * 待機中の予約を、作成と同じ入力で置き換える。
 *
 * 処理の順序:
 * 1. 所有と状態の確認（存在しない・終了済みは 404、実行中は 409）
 * 2. 入力の検証と画像の保管（新しい世代のキーに書く）
 * 3. 待機中の行に限った置き換え。間に実行が始まっていたら、新しい画像を消して 409
 * 4. 置き換え前の画像の削除（失敗は記録だけする）
 *
 * Input:
 * - `did`: セッションのアカウント
 * - `id`: 予約の識別子（ページが検証済み）
 * - `request`: リクエスト（multipart の本文を読む）
 *
 * Output:
 * - 成功: `{ ok: true, value: { id, runAt } }`（`runAt` は ISO 文字列）
 * - 失敗: 400（入力の不正）・404（対象外の状態）・409（実行中・認証情報の未登録。`code` は現行の応答の `error`）・500（画像の保管）
 * - 保存の失敗は例外として呼び出し側へ投げる（保管した新しい画像は削除する）
 *
 * Example: `const result = await replaceSchedule({ did, id, request })`
 */
export const replaceSchedule = async (input: {
    did: string
    id: string
    request: Request
}): Promise<Outcome<{ id: string; runAt: string }>> => {
    const { did, id, request } = input
    const env = await getScheduleEnv()
    const current = await getSchedule(env.DB, did, id)
    if (!current) return { ok: false, status: 404 }
    if (current.status === "running") {
        return { ok: false, status: 409, code: "ScheduleRunning" }
    }
    if (current.status !== "pending") return { ok: false, status: 404 }

    const body = await parseScheduleBody(request, did)
    if (!body) return { ok: false, status: 400 }

    const now = Math.floor(Date.now() / 1000)
    const staged = await stageSchedule(env, did, id, body, now, {
        countPending: false,
    })
    if (!staged.ok) {
        return staged.error
            ? { ok: false, status: staged.status, code: staged.error }
            : { ok: false, status: staged.status }
    }

    const replaced = await updatePendingSchedule(
        env.DB,
        did,
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
        return { ok: false, status: 409, code: "ScheduleRunning" }
    }
    try {
        await removeImages(env.SCHEDULE_IMAGES, replaced.previousImageKeys)
    } catch (err) {
        console.error(`schedules PUT: removeImages failed id=${id}`, err)
    }

    return { ok: true, value: { id, runAt: toIso(staged.runAt) } }
}

/**
 * 自分の予約を取り消す。待機中は取り消し、失敗は履歴として削除する。保管した画像も削除する。
 *
 * 処理の順序: 行の所有 → 実行中（409）→ 削除（確認と削除の間に実行が始まったら 409）→ 画像の後始末（失敗は記録だけする）。
 *
 * Input:
 * - `did`: セッションのアカウント
 * - `id`: 予約の識別子（ページが検証済み）
 *
 * Output:
 * - 成功: `{ ok: true, value: {} }`
 * - 失敗: 404（予約なし）・409（実行中。`code` は ScheduleRunning）
 *
 * Example: `const result = await cancelSchedule({ did: session.did, id: "s1" })`
 */
export const cancelSchedule = async (input: {
    did: string
    id: string
}): Promise<Outcome<Record<string, never>>> => {
    const env = await getScheduleEnv()
    const current = await getSchedule(env.DB, input.did, input.id)
    if (!current) return { ok: false, status: 404 }
    if (current.status === "running") {
        return { ok: false, status: 409, code: "ScheduleRunning" }
    }

    // 確認と削除の間に実行が始まった場合は、削除せず null が返る
    const deleted = await deleteSchedule(env.DB, input.did, input.id)
    if (!deleted) return { ok: false, status: 409, code: "ScheduleRunning" }

    try {
        await removeImages(env.SCHEDULE_IMAGES, parseKeys(deleted.imageKeys))
    } catch (err) {
        console.error("schedules DELETE: removeImages failed", err)
    }
    return { ok: true, value: {} }
}
