/** 予約を D1 に保存・検索・更新するとき、所有アカウント DID を条件に含める。 */
import type { D1Database } from "@/lib/platform/cfTypes"
import type {
    NewSchedule,
    ScheduleRow,
    ScheduleStatus,
} from "@/lib/schedule/types"
import { changesOf, toScheduleRow, type DbRow } from "./rows"

/** 予約を待機中として保存する（問い合わせ1回）。 */
export const insertSchedule = async (
    db: D1Database,
    row: NewSchedule,
): Promise<void> => {
    await db
        .prepare(
            `INSERT INTO scheduled_posts
             (id, did, run_at, status, payload, image_keys, updated_at)
             VALUES (?, ?, ?, 'pending', ?, ?, ?)`,
        )
        .bind(
            row.id,
            row.did,
            row.runAt,
            row.payload,
            JSON.stringify(row.imageKeys),
            row.now,
        )
        .run()
}

/** 自分の予約を1件取得する。他のアカウントの予約は null になる（問い合わせ1回）。 */
export const getSchedule = async (
    db: D1Database,
    did: string,
    id: string,
): Promise<ScheduleRow | null> => {
    const row = await db
        .prepare("SELECT * FROM scheduled_posts WHERE did = ? AND id = ?")
        .bind(did, id)
        .first<DbRow>()
    return row ? toScheduleRow(row) : null
}

const encodeCursor = (runAt: number, id: string): string =>
    btoa(`${runAt}:${id}`)

const decodeCursor = (cursor: string): { runAt: number; id: string } | null => {
    try {
        const text = atob(cursor)
        const i = text.indexOf(":")
        const runAt = Number(text.slice(0, i))
        const id = text.slice(i + 1)
        return i > 0 && Number.isFinite(runAt) && id ? { runAt, id } : null
    } catch {
        return null
    }
}

/** 自分の予約を実行時刻の昇順で一覧する。続きがあるときだけ cursor を返す。 */
export const listSchedules = async (
    db: D1Database,
    did: string,
    opts: { status?: ScheduleStatus; limit: number; cursor?: string },
): Promise<{ items: ScheduleRow[]; cursor?: string }> => {
    const where = ["did = ?"]
    const params: (string | number)[] = [did]
    if (opts.status) {
        where.push("status = ?")
        params.push(opts.status)
    }
    const after = opts.cursor ? decodeCursor(opts.cursor) : null
    if (after) {
        where.push("(run_at, id) > (?, ?)")
        params.push(after.runAt, after.id)
    }
    const { results } = await db
        .prepare(
            `SELECT * FROM scheduled_posts WHERE ${where.join(" AND ")}
             ORDER BY run_at, id LIMIT ?`,
        )
        .bind(...params, opts.limit + 1)
        .all<DbRow>()
    const rows = results.map(toScheduleRow)
    const items = rows.slice(0, opts.limit)
    const last = items[items.length - 1]
    return rows.length > opts.limit && last
        ? { items, cursor: encodeCursor(last.runAt, last.id) }
        : { items }
}

/**
 * 自分の予約を削除し、削除した行を返す。
 * 実行中の予約は削除せず null を返す（実行を止めずに行が消えるのを防ぐ）。
 */
export const deleteSchedule = async (
    db: D1Database,
    did: string,
    id: string,
): Promise<ScheduleRow | null> => {
    const { results } = await db
        .prepare(
            `DELETE FROM scheduled_posts
             WHERE did = ? AND id = ? AND status != 'running' RETURNING *`,
        )
        .bind(did, id)
        .all<DbRow>()
    return results[0] ? toScheduleRow(results[0]) : null
}

/**
 * 自分の待機中の予約を置き換える（問い合わせ2回）。
 *
 * 処理の趣旨:
 * - 置き換え前の画像のキーを呼び出し側が削除できるよう、先に行を読む。
 * - 更新は `status = 'pending'` の行に限る。読んでから更新するまでに実行が始まった予約は
 *   更新0件になり、null を返す（実行中の予約の内容を書き換えない）。
 * - 内容が変わるため、実行の進捗と再試行の回数は初期値に戻す。
 *
 * Input:
 * - `did` `id`: 所有アカウントと予約の識別子
 * - `next`: 新しい実行時刻（UNIX 秒）・保管用の本文・画像のキー
 * - `now`: 現在時刻（UNIX 秒）
 *
 * Output: 置き換えたら `{ previousImageKeys }`、待機中の自分の予約が無ければ null
 *
 * Example: `await updatePendingSchedule(db, did, "s1", { runAt, payload, imageKeys }, now)`
 */
export const updatePendingSchedule = async (
    db: D1Database,
    did: string,
    id: string,
    next: { runAt: number; payload: string; imageKeys: string[] },
    now: number,
): Promise<{ previousImageKeys: string[] } | null> => {
    const current = await getSchedule(db, did, id)
    if (!current || current.status !== "pending") return null
    const result = await db
        .prepare(
            `UPDATE scheduled_posts
             SET run_at = ?, payload = ?, image_keys = ?, progress = '{}',
                 attempts = 0, updated_at = ?
             WHERE did = ? AND id = ? AND status = 'pending'`,
        )
        .bind(
            next.runAt,
            next.payload,
            JSON.stringify(next.imageKeys),
            now,
            did,
            id,
        )
        .run()
    if (changesOf(result) === 0) return null
    return { previousImageKeys: parseKeys(current.imageKeys) }
}

/**
 * 自分の待機中と失敗の予約をすべて削除し、削除した行を返す（問い合わせ1回）。
 * 予約投稿を無効にするときに使う。画像の削除は、返った行の画像のキーを使って呼び出し側が行う。
 *
 * Input: `did`: 所有アカウント
 * Output: 削除した行の配列（実行中の行は残る）
 * Example: `const rows = await deleteSchedulesExceptRunning(db, did)`
 */
export const deleteSchedulesExceptRunning = async (
    db: D1Database,
    did: string,
): Promise<ScheduleRow[]> => {
    const { results } = await db
        .prepare(
            `DELETE FROM scheduled_posts
             WHERE did = ? AND status IN ('pending', 'failed') RETURNING *`,
        )
        .bind(did)
        .all<DbRow>()
    return results.map(toScheduleRow)
}

/**
 * 行の `image_keys`（JSON 文字列）をキーの配列にする。壊れた値は空配列とみなす。
 *
 * Input: `'["schedules/d/s/g/0"]'` → Output: `["schedules/d/s/g/0"]`
 */
export const parseKeys = (imageKeys: string): string[] => {
    try {
        const keys: unknown = JSON.parse(imageKeys)
        return Array.isArray(keys)
            ? keys.filter((k): k is string => typeof k === "string")
            : []
    } catch {
        return []
    }
}

/** 自分の待機中の予約の件数。 */
export const countPending = async (
    db: D1Database,
    did: string,
): Promise<number> => {
    const row = await db
        .prepare(
            "SELECT COUNT(*) AS n FROM scheduled_posts WHERE did = ? AND status = 'pending'",
        )
        .bind(did)
        .first<{ n: number }>()
    return Number(row?.n ?? 0)
}
