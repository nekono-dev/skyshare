/**
 * 予約投稿の保管（D1）。
 *
 * 責務と処理概要:
 * - 予約の保存・取得・一覧・置き換え・削除・件数を、常に所有アカウント（did）を条件に含めて行う。
 * - 実行時刻が到来した待機中の予約を、1文の更新で実行中へ遷移させて取り出す。
 *   同時に走る別の実行と同じ予約を取り合わない。
 * - 実行の進捗の保存・待機への戻し・失敗の記録と成功した予約の削除・停止した予約の回収・失敗履歴の削除を行う。
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

// ---------------------------------------------------------------------------
// 予約用の認証情報
// ---------------------------------------------------------------------------

/**
 * 認証情報（リフレッシュトークン）を暗号化して、アカウントごとに1件だけ保管する。
 * 保管すると再度の許可が必要である印は外れる。
 *
 * Input:
 * - `opts.authorized`: 真なら新しく許可を得たものとして、許可の時刻を `now` にする
 *   （トークンの回転による保管し直しでは偽にし、許可の時刻を保つ）
 * Example: `await saveCredential(db, key, { did, service, token }, now, { authorized: true })`
 */
export const saveCredential = async (
    db: D1Database,
    secret: string,
    c: { did: string; service: string; token: string },
    now: number,
    opts: { authorized?: boolean } = {},
): Promise<void> => {
    const enc = await encryptToken(secret, c.did, c.token)
    await db
        .prepare(
            `INSERT INTO schedule_credentials
               (did, service, token_enc, updated_at, authorized_at, reauth_required)
             VALUES (?, ?, ?, ?, ?, 0)
             ON CONFLICT (did) DO UPDATE SET
               service = excluded.service,
               token_enc = excluded.token_enc,
               updated_at = excluded.updated_at,
               authorized_at = CASE WHEN ? THEN excluded.authorized_at
                                    ELSE schedule_credentials.authorized_at END,
               reauth_required = 0`,
        )
        .bind(c.did, c.service, enc, now, now, opts.authorized ? 1 : 0)
        .run()
}

/**
 * 保管した認証情報を復号して返す。無いとき・再度の許可が必要なときは null。
 * 復号に失敗したら例外を投げる。
 */
export const loadCredential = async (
    db: D1Database,
    secret: string,
    did: string,
): Promise<{ service: string; token: string } | null> => {
    const row = await db
        .prepare(
            "SELECT service, token_enc FROM schedule_credentials WHERE did = ? AND reauth_required = 0",
        )
        .bind(did)
        .first<{ service: string; token_enc: string }>()
    if (!row) return null
    return {
        service: row.service,
        token: await decryptToken(secret, did, row.token_enc),
    }
}

export type CredentialStatus =
    | { registered: false }
    | {
          registered: true
          /** 許可が無効になり、再度の許可が必要 */
          reauthRequired: boolean
          /** 最後の使用の時刻（UNIX 秒） */
          updatedAt: number
          /** 許可を得た時刻（UNIX 秒） */
          authorizedAt: number
          /** 待機中・実行中の予約の最も遅い実行時刻（UNIX 秒）。無ければ null */
          latestRunAt: number | null
      }

/**
 * 登録の有無と、再度の許可の要否・使用と許可の時刻を返す（トークンは復号しない）。
 * 再度の許可が必要な印だけの行も「登録あり」として返す（設定のスイッチをオフに戻さないため）。
 */
export const getCredentialStatus = async (
    db: D1Database,
    did: string,
): Promise<CredentialStatus> => {
    const row = await db
        .prepare(
            `SELECT updated_at, authorized_at, reauth_required,
               (SELECT MAX(run_at) FROM scheduled_posts
                WHERE scheduled_posts.did = schedule_credentials.did
                  AND status IN ('pending', 'running')) AS latest_run_at
             FROM schedule_credentials WHERE did = ?`,
        )
        .bind(did)
        .first<{
            updated_at: number
            authorized_at: number
            reauth_required: number
            latest_run_at: number | null
        }>()
    if (!row) return { registered: false }
    return {
        registered: true,
        reauthRequired: Number(row.reauth_required) === 1,
        updatedAt: Number(row.updated_at),
        authorizedAt: Number(row.authorized_at),
        latestRunAt:
            row.latest_run_at === null ? null : Number(row.latest_run_at),
    }
}

/**
 * 認証情報の最後の使用の時刻（`updated_at`）を現在時刻にする。
 * 予約の作成と置き換えのたびに呼び、使われ続けている認証情報を未使用の削除から外す。
 *
 * Input: `did`、`now`（UNIX 秒）
 * Output: なし（行が無ければ何もしない）
 * Example: `await touchCredential(db, did, now)`
 */
export const touchCredential = async (
    db: D1Database,
    did: string,
    now: number,
): Promise<void> => {
    await db
        .prepare("UPDATE schedule_credentials SET updated_at = ? WHERE did = ?")
        .bind(now, did)
        .run()
}

/**
 * 予約の有無によらず、アカウントの認証情報を削除する。
 * 利用者が予約投稿を無効にしたときと、実行で認証の失効が分かったときに使う。
 *
 * Input: `did`
 * Output: なし
 * Example: `await deleteCredential(db, did)`
 */
export const deleteCredential = async (
    db: D1Database,
    did: string,
): Promise<void> => {
    await db
        .prepare("DELETE FROM schedule_credentials WHERE did = ?")
        .bind(did)
        .run()
}

/**
 * 認証情報を消し、再度の許可が必要である印だけを残す。
 * 実行で許可の失効が分かったときに使う。最後の使用の時刻は変えない。
 *
 * Input: `did`
 * Output: なし（行が無ければ何もしない）
 * Example: `await markCredentialReauth(db, did)`
 */
export const markCredentialReauth = async (
    db: D1Database,
    did: string,
): Promise<void> => {
    await db
        .prepare(
            "UPDATE schedule_credentials SET token_enc = '', reauth_required = 1 WHERE did = ?",
        )
        .bind(did)
        .run()
}

/** 待機中も実行中の予約もないことの条件（認証情報の行に対して使う） */
const NO_ACTIVE_SCHEDULE = `NOT EXISTS (
    SELECT 1 FROM scheduled_posts
    WHERE scheduled_posts.did = schedule_credentials.did
      AND status IN ('pending', 'running')
  )`

/**
 * 最後の使用から `idleSeconds` を過ぎ、待機中も実行中の予約もないアカウントの認証情報を消し、
 * 再度の許可が必要である印だけを残す（設定のスイッチをオフに戻さないため）。
 * 判定と更新を1文で行い、予約の作成との競合で必要な認証情報を消さないようにする。
 *
 * Input: `now`（UNIX 秒）、`idleSeconds`（未使用とみなす秒数）
 * Output: 印に替えた件数
 * Example: `await purgeIdleCredentials(db, now, CREDENTIAL_IDLE_SECONDS)`
 */
export const purgeIdleCredentials = async (
    db: D1Database,
    now: number,
    idleSeconds: number,
): Promise<number> => {
    const result = await db
        .prepare(
            `UPDATE schedule_credentials SET token_enc = '', reauth_required = 1
             WHERE reauth_required = 0 AND updated_at < ? AND ${NO_ACTIVE_SCHEDULE}`,
        )
        .bind(now - idleSeconds)
        .run()
    return changesOf(result)
}

/**
 * 最後の使用から `retentionSeconds` を過ぎた、再度の許可が必要である印を削除する。
 *
 * Input: `now`（UNIX 秒）、`retentionSeconds`（印を保つ秒数）
 * Output: 削除した件数
 * Example: `await purgeReauthMarkers(db, now, REAUTH_MARKER_KEEP_SECONDS)`
 */
export const purgeReauthMarkers = async (
    db: D1Database,
    now: number,
    retentionSeconds: number,
): Promise<number> => {
    const result = await db
        .prepare(
            `DELETE FROM schedule_credentials
             WHERE reauth_required = 1 AND updated_at < ? AND ${NO_ACTIVE_SCHEDULE}`,
        )
        .bind(now - retentionSeconds)
        .run()
    return changesOf(result)
}

/** 予約がないまま、この秒数だけ使われなかった認証情報を消して印に替える（30日） */
export const CREDENTIAL_IDLE_SECONDS = 30 * 24 * 60 * 60

/** 再度の許可が必要である印を、最後の使用からこの秒数だけ保つ（180日） */
export const REAUTH_MARKER_KEEP_SECONDS = 180 * 24 * 60 * 60

// ---------------------------------------------------------------------------
// OAuth の認可の途中の状態
// ---------------------------------------------------------------------------

/** 認可の開始から戻りまでに許す秒数（10分） */
export const OAUTH_STATE_TTL_SECONDS = 10 * 60

/**
 * 認可の途中の状態を暗号化して保存する（問い合わせ1回）。
 *
 * Input: `state`（認可の要求に付けた乱数）、`did`、`data`（PKCE の verifier などを含む JSON 文字列）
 */
export const saveOAuthState = async (
    db: D1Database,
    secret: string,
    s: { state: string; did: string; data: string },
    now: number,
): Promise<void> => {
    const enc = await encryptToken(secret, s.did, s.data)
    await db
        .prepare(
            `INSERT INTO schedule_oauth_states (state, did, data_enc, created_at)
             VALUES (?, ?, ?, ?)`,
        )
        .bind(s.state, s.did, enc, now)
        .run()
}

/**
 * 認可の途中の状態を取り出して削除する（1回しか使えない）。
 * 別のアカウントの状態と、期限を過ぎた状態は返さない。
 *
 * Output: 保存した `data`。無ければ null
 */
export const takeOAuthState = async (
    db: D1Database,
    secret: string,
    state: string,
    did: string,
    now: number,
): Promise<string | null> => {
    const { results } = await db
        .prepare(
            "DELETE FROM schedule_oauth_states WHERE state = ? RETURNING *",
        )
        .bind(state)
        .all<{ did: string; data_enc: string; created_at: number }>()
    const row = results[0]
    if (!row || row.did !== did) return null
    if (Number(row.created_at) < now - OAUTH_STATE_TTL_SECONDS) return null
    return decryptToken(secret, did, row.data_enc)
}

/** 期限を過ぎた認可の途中の状態を削除し、削除した件数を返す */
export const purgeOAuthStates = async (
    db: D1Database,
    now: number,
): Promise<number> => {
    const result = await db
        .prepare("DELETE FROM schedule_oauth_states WHERE created_at < ?")
        .bind(now - OAUTH_STATE_TTL_SECONDS)
        .run()
    return changesOf(result)
}
