/**
 * 予約投稿の保管（D1）。
 *
 * 責務と処理概要:
 * - 予約の保存・取得・一覧・削除・件数を、常に所有アカウント（did）を条件に含めて行う。
 * - 実行時刻が到来した待機中の予約を、1文の更新で実行中へ遷移させて取り出す。
 *   同時に走る別の実行と同じ予約を取り合わない。
 * - 実行の進捗の保存・待機への戻し・終了の記録・停止した予約の回収・履歴の削除を行う。
 * - 予約用の認証情報の保管は、同じファイルの後半（認証情報の節）にある。
 */
import { decryptToken, encryptToken } from "./credentialCrypto"
import type { D1Database } from "./cfTypes"
import {
    CLAIM_LIMIT,
    type NewSchedule,
    type Progress,
    type ScheduleRow,
    type ScheduleStatus,
} from "./types"

type DbRow = Record<string, unknown>

const toScheduleRow = (r: DbRow): ScheduleRow => ({
    id: r.id as string,
    did: r.did as string,
    runAt: Number(r.run_at),
    status: r.status as ScheduleStatus,
    payload: r.payload as string,
    imageKeys: r.image_keys as string,
    progress: r.progress as string,
    attempts: Number(r.attempts),
    lastError: (r.last_error as string | null) ?? null,
    resultUri: (r.result_uri as string | null) ?? null,
    updatedAt: Number(r.updated_at),
    finishedAt: r.finished_at == null ? null : Number(r.finished_at),
})

const changesOf = (result: { meta?: { changes?: number } }): number =>
    result.meta?.changes ?? 0

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

/** 実行中の予約を投稿済みまたは失敗として終了する。 */
export const finishSchedule = async (
    db: D1Database,
    id: string,
    result: {
        status: "posted" | "failed"
        resultUri?: string
        lastError?: string
    },
    now: number,
): Promise<void> => {
    await db
        .prepare(
            `UPDATE scheduled_posts
             SET status = ?, result_uri = ?, last_error = ?,
                 updated_at = ?, finished_at = ?
             WHERE id = ? AND status = 'running'`,
        )
        .bind(
            result.status,
            result.resultUri ?? null,
            result.lastError ?? null,
            now,
            now,
            id,
        )
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
 * 終了（投稿済み・失敗）から retentionSeconds を過ぎた予約を削除し、削除した行を返す。
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
             WHERE status IN ('posted', 'failed') AND finished_at < ?
             RETURNING *`,
        )
        .bind(now - retentionSeconds)
        .all<DbRow>()
    return results.map(toScheduleRow)
}

export const STALE_SECONDS = 600
export const FINISHED_RETENTION_SECONDS = 7 * 24 * 60 * 60

// ---------------------------------------------------------------------------
// 予約用の認証情報
// ---------------------------------------------------------------------------

/** 認証情報（リフレッシュトークン）を暗号化して、アカウントごとに1件だけ保管する。 */
export const saveCredential = async (
    db: D1Database,
    secret: string,
    c: { did: string; service: string; token: string },
    now: number,
): Promise<void> => {
    const enc = await encryptToken(secret, c.did, c.token)
    await db
        .prepare(
            `INSERT INTO schedule_credentials (did, service, token_enc, updated_at)
             VALUES (?, ?, ?, ?)
             ON CONFLICT (did) DO UPDATE SET
               service = excluded.service,
               token_enc = excluded.token_enc,
               updated_at = excluded.updated_at`,
        )
        .bind(c.did, c.service, enc, now)
        .run()
}

/** 保管した認証情報を復号して返す。無ければ null。復号に失敗したら例外を投げる。 */
export const loadCredential = async (
    db: D1Database,
    secret: string,
    did: string,
): Promise<{ service: string; token: string } | null> => {
    const row = await db
        .prepare(
            "SELECT service, token_enc FROM schedule_credentials WHERE did = ?",
        )
        .bind(did)
        .first<{ service: string; token_enc: string }>()
    if (!row) return null
    return {
        service: row.service,
        token: await decryptToken(secret, did, row.token_enc),
    }
}

/** 登録の有無と更新時刻だけを返す（トークンは復号しない）。 */
export const getCredentialStatus = async (
    db: D1Database,
    did: string,
): Promise<{ registered: boolean; updatedAt?: number }> => {
    const row = await db
        .prepare("SELECT updated_at FROM schedule_credentials WHERE did = ?")
        .bind(did)
        .first<{ updated_at: number }>()
    return row
        ? { registered: true, updatedAt: Number(row.updated_at) }
        : { registered: false }
}

/**
 * 待機中も実行中の予約もないときだけ、アカウントの認証情報を削除して true を返す。
 * 判定と削除を1文で行い、予約の作成との競合で必要な認証情報を消さないようにする。
 */
export const purgeIdleCredential = async (
    db: D1Database,
    did: string,
): Promise<boolean> => {
    const result = await db
        .prepare(
            `DELETE FROM schedule_credentials
             WHERE did = ? AND NOT EXISTS (
               SELECT 1 FROM scheduled_posts
               WHERE did = ? AND status IN ('pending', 'running')
             )`,
        )
        .bind(did, did)
        .run()
    return changesOf(result) > 0
}
