/** 予約実行の状態遷移と進捗・履歴の保管を行う。 */
import type { D1Database } from "@/lib/platform/cfTypes"
import {
    CLAIM_LIMIT,
    type Progress,
    type ScheduleRow,
} from "@/lib/schedule/types"
import { changesOf, toScheduleRow, type DbRow } from "./rows"

/**
 * 実行時刻が到来した待機中の予約を、実行時刻の早い順に最大 limit 件、実行中にして返す。
 * 取り出しと遷移を1文で行うため、同じ予約を2回取り出すことはない。
 * limit は CLAIM_LIMIT を超えても CLAIM_LIMIT に丸める。
 */
export const claimDueSchedules = async (
    db: D1Database,
    now: number,
    limit: number,
): Promise<ScheduleRow[]> => {
    const n = Math.max(0, Math.min(limit, CLAIM_LIMIT))
    if (n === 0) return []
    const { results } = await db
        .prepare(
            `UPDATE scheduled_posts SET status = 'running', updated_at = ?
             WHERE id IN (
               SELECT id FROM scheduled_posts
               WHERE status = 'pending' AND run_at <= ?
               ORDER BY run_at, id LIMIT ?
             ) RETURNING *`,
        )
        .bind(now, now, n)
        .all<DbRow>()
    return results
        .map(toScheduleRow)
        .sort((a, b) => a.runAt - b.runAt || a.id.localeCompare(b.id))
}

/**
 * 実行中の予約の進捗を保存する。実行中でなければ更新せず false を返す
 * （別の実行に回収された予約への書き込みを防ぐ）。
 */
export const saveProgress = async (
    db: D1Database,
    id: string,
    progress: Progress,
    now: number,
    attempts?: number,
): Promise<boolean> => {
    const result = await db
        .prepare(
            `UPDATE scheduled_posts
             SET progress = ?, attempts = COALESCE(?, attempts), updated_at = ?
             WHERE id = ? AND status = 'running'`,
        )
        .bind(JSON.stringify(progress), attempts ?? null, now, id)
        .run()
    return changesOf(result) > 0
}

/**
 * 実行中の予約を、進捗を保ったまま待機中へ戻す。
 * countAttempt が真のときだけ再試行の回数を1増やす。
 */
export const releaseSchedule = async (
    db: D1Database,
    id: string,
    countAttempt: boolean,
    now: number,
): Promise<void> => {
    await db
        .prepare(
            `UPDATE scheduled_posts
             SET status = 'pending', attempts = attempts + ?, updated_at = ?
             WHERE id = ? AND status = 'running'`,
        )
        .bind(countAttempt ? 1 : 0, now, id)
        .run()
}

/**
 * 実行中の予約を失敗として終了する。
 * 失敗の予約は、利用者がフォームへ書き戻せるよう内容と画像を残す（履歴の保持期間で削除する）。
 */
export const failSchedule = async (
    db: D1Database,
    id: string,
    lastError: string,
    now: number,
): Promise<void> => {
    await db
        .prepare(
            `UPDATE scheduled_posts
             SET status = 'failed', last_error = ?, updated_at = ?, finished_at = ?
             WHERE id = ? AND status = 'running'`,
        )
        .bind(lastError, now, now, id)
        .run()
}

/**
 * 実行中の予約を、投稿を終えたものとして削除する。
 * 成功した予約は履歴に残さない。実行中でなければ（別の実行に回収された）何もしない。
 */
export const completeSchedule = async (
    db: D1Database,
    id: string,
): Promise<void> => {
    await db
        .prepare(
            "DELETE FROM scheduled_posts WHERE id = ? AND status = 'running'",
        )
        .bind(id)
        .run()
}

/**
 * 実行中のまま staleSeconds より長く更新のない予約を待機中へ戻す。
 * 戻した予約は再試行の回数を1増やす。戻した件数を返す。
 */
export const requeueStale = async (
    db: D1Database,
    now: number,
    staleSeconds: number,
): Promise<number> => {
    const result = await db
        .prepare(
            `UPDATE scheduled_posts
             SET status = 'pending', attempts = attempts + 1, updated_at = ?
             WHERE status = 'running' AND updated_at < ?`,
        )
        .bind(now, now - staleSeconds)
        .run()
    return changesOf(result)
}

/**
 * 失敗から retentionSeconds を過ぎた予約を削除し、削除した行を返す。
 * 呼び出し側は、返った行の画像のキーが残っていれば画像を削除する。
 */
export const purgeFinished = async (
    db: D1Database,
    now: number,
    retentionSeconds: number,
): Promise<ScheduleRow[]> => {
    const { results } = await db
        .prepare(
            `DELETE FROM scheduled_posts
             WHERE status = 'failed' AND finished_at < ?
             RETURNING *`,
        )
        .bind(now - retentionSeconds)
        .all<DbRow>()
    return results.map(toScheduleRow)
}

export const STALE_SECONDS = 600
export const FINISHED_RETENTION_SECONDS = 7 * 24 * 60 * 60
