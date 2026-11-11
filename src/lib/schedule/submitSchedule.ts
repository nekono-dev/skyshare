/** 投稿フォームから予約を作成・編集・取消し、編集用の内容を取得する。 */
import {
    createSchedule,
    deleteSchedule,
    getSchedule,
    getScheduleImage,
    listSchedules,
    updateSchedule,
} from "@/client/openapi/client"
import type {
    CreateScheduleBody,
    ScheduleDetail,
    UpdateScheduleBody,
} from "@/client/openapi/model"
import type { PlainMessageKey } from "@/lib/i18n/translate"
import { toRunAtIso } from "./runAtInput"
import { scheduleErrorKey } from "./scheduleErrorKey"

type Result = { ok: true } | { ok: false; messageKey: PlainMessageKey }

/** 応答の本文から `error` の識別子を取り出す（無ければ undefined） */
const errorCodeOf = (data: unknown): string | undefined =>
    data && typeof data === "object" && "error" in data
        ? String((data as { error?: unknown }).error ?? "") || undefined
        : undefined

/**
 * 予約を作成または置き換える。
 *
 * Input:
 * - `target`: 新規の予約（`create`）か、編集中の予約（`update`）と実行日時
 * - `body`: 投稿の作成と同じ組み立ての本文（`runAt` を除く）
 *
 * Output: 成功は `{ ok: true }`、失敗は文言キー。通信の失敗は `error.network`
 *
 * Example: `await submitSchedule({ kind: "create", runAt }, body)`
 */
export const submitSchedule = async (
    target:
        | { kind: "create"; runAt: Date }
        | { kind: "update"; id: string; runAt: Date },
    body: Omit<CreateScheduleBody, "runAt">,
): Promise<Result> => {
    try {
        const runAt = toRunAtIso(target.runAt)
        const res =
            target.kind === "create"
                ? await createSchedule({ ...body, runAt } as CreateScheduleBody)
                : await updateSchedule(target.id, {
                      ...body,
                      runAt,
                  } as UpdateScheduleBody)
        if (res.status === 200) return { ok: true }
        return {
            ok: false,
            messageKey: scheduleErrorKey(res.status, errorCodeOf(res.data)),
        }
    } catch {
        console.error("submitSchedule: request failed")
        return { ok: false, messageKey: "error.network" }
    }
}

/**
 * 待機中の予約を取り消す。
 *
 * Example: `await cancelSchedule("s1")` → `{ ok: true }`
 */
export const cancelSchedule = async (id: string): Promise<Result> => {
    try {
        const res = await deleteSchedule(id)
        if (res.status === 200) return { ok: true }
        return {
            ok: false,
            messageKey: scheduleErrorKey(res.status, errorCodeOf(res.data)),
        }
    } catch {
        console.error("cancelSchedule: request failed")
        return { ok: false, messageKey: "error.network" }
    }
}

/**
 * 予約の内容に含まれる画像の番号をすべて集める（重複なし、昇順）。
 *
 * Example: `{ posts: [{ images: [0, 1] }, { ogImage: 2 }], visual: 3 }` → `[0, 1, 2, 3]`
 */
export const imageIndexesOf = (detail: ScheduleDetail): number[] => {
    const indexes = new Set<number>()
    for (const post of detail.posts) {
        for (const n of post.images ?? []) indexes.add(n)
        if (post.ogImage !== undefined) indexes.add(post.ogImage)
    }
    if (detail.visual !== undefined) indexes.add(detail.visual)
    return [...indexes].sort((a, b) => a - b)
}

/**
 * 編集のために、予約の内容と画像を取得する。
 *
 * Output:
 * - 成功: `{ ok: true, runAt, detail, images }`。`images[n]` は番号 n の画像
 * - 失敗: 文言キー（実行が始まった予約は `schedule.error.running`、終了・削除済みは `schedule.error.notFound`）
 *
 * Example: `const loaded = await fetchScheduleForEdit("s1")`
 */
export const fetchScheduleForEdit = async (
    id: string,
): Promise<
    | { ok: true; runAt: Date; detail: ScheduleDetail; images: Blob[] }
    | { ok: false; messageKey: PlainMessageKey }
> => {
    try {
        const res = await getSchedule(id)
        if (res.status !== 200) {
            return {
                ok: false,
                messageKey: scheduleErrorKey(res.status, errorCodeOf(res.data)),
            }
        }
        const detail = res.data
        const images: Blob[] = []
        const fetched = await Promise.all(
            imageIndexesOf(detail).map(async index => ({
                index,
                res: await getScheduleImage(id, index),
            })),
        )
        for (const { index, res: imageRes } of fetched) {
            if (imageRes.status !== 200 || !(imageRes.data instanceof Blob)) {
                return {
                    ok: false,
                    messageKey: scheduleErrorKey(
                        imageRes.status,
                        errorCodeOf(imageRes.data),
                    ),
                }
            }
            images[index] = imageRes.data
        }
        return { ok: true, runAt: new Date(detail.runAt), detail, images }
    } catch {
        console.error("fetchScheduleForEdit: request failed")
        return { ok: false, messageKey: "error.network" }
    }
}

/**
 * 自分の待機中の予約の件数を取得する（予約の枠の表示に使う）。
 *
 * Output: 件数。取得に失敗したら null
 * Example: `await fetchPendingCount()` → `3`
 */
export const fetchPendingCount = async (): Promise<number | null> => {
    try {
        const res = await listSchedules({ status: "pending", limit: 50 })
        return res.status === 200 ? res.data.items.length : null
    } catch {
        return null
    }
}
