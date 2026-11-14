/** 予約用認証情報を暗号化して保管し、状態確認と未使用情報の整理を行う。 */
import type { D1Database } from "@/lib/platform/cfTypes"
import { decryptToken, encryptToken } from "@/lib/schedule/credentialCrypto"
import { changesOf } from "./rows"

/**
 * 認証情報（リフレッシュトークン）を暗号化して、アカウントごとに1件だけ保管する。
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
               (did, service, token_enc, updated_at, authorized_at)
             VALUES (?, ?, ?, ?, ?)
             ON CONFLICT (did) DO UPDATE SET
               service = excluded.service,
               token_enc = excluded.token_enc,
               updated_at = excluded.updated_at,
               authorized_at = CASE WHEN ? THEN excluded.authorized_at
                                    ELSE schedule_credentials.authorized_at END`,
        )
        .bind(c.did, c.service, enc, now, now, opts.authorized ? 1 : 0)
        .run()
}

/**
 * 保管した認証情報を復号して返す。無いときは null。
 * 復号に失敗したら例外を投げる。
 */
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

export type CredentialStatus =
    | { registered: false }
    | {
          registered: true
          /** 最後の使用の時刻（UNIX 秒） */
          updatedAt: number
          /** 許可を得た時刻（UNIX 秒） */
          authorizedAt: number
          /** 待機中・実行中の予約の最も遅い実行時刻（UNIX 秒）。無ければ null */
          latestRunAt: number | null
      }

/**
 * 登録の有無と、認証情報の使用・許可の時刻を返す（トークンは復号しない）。
 */
export const getCredentialStatus = async (
    db: D1Database,
    did: string,
): Promise<CredentialStatus> => {
    const row = await db
        .prepare(
            `SELECT updated_at, authorized_at,
               (SELECT MAX(run_at) FROM scheduled_posts
                WHERE scheduled_posts.did = schedule_credentials.did
                  AND status IN ('pending', 'running')) AS latest_run_at
             FROM schedule_credentials WHERE did = ?`,
        )
        .bind(did)
        .first<{
            updated_at: number
            authorized_at: number
            latest_run_at: number | null
        }>()
    if (!row) return { registered: false }
    return {
        registered: true,
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
 * Output: 更新できたら true、行が無ければ false（呼び出し側は、削除と重なったことを知れる）
 * Example: `await touchCredential(db, did, now)` → `true`
 */
export const touchCredential = async (
    db: D1Database,
    did: string,
    now: number,
): Promise<boolean> => {
    const result = await db
        .prepare("UPDATE schedule_credentials SET updated_at = ? WHERE did = ?")
        .bind(now, did)
        .run()
    return changesOf(result) > 0
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

/** 待機中も実行中の予約もないことの条件（認証情報の行に対して使う） */
const NO_ACTIVE_SCHEDULE = `NOT EXISTS (
    SELECT 1 FROM scheduled_posts
    WHERE scheduled_posts.did = schedule_credentials.did
      AND status IN ('pending', 'running')
  )`

/**
 * 最後の使用から `idleSeconds` を過ぎ、待機中も実行中の予約もないアカウントの認証情報を削除する。
 * 判定と削除を1文で行い、予約の作成との競合で必要な認証情報を消さないようにする。
 *
 * Input: `now`（UNIX 秒）、`idleSeconds`（未使用とみなす秒数）
 * Output: 削除した件数
 * Example: `await purgeIdleCredentials(db, now, CREDENTIAL_IDLE_SECONDS)`
 */
export const purgeIdleCredentials = async (
    db: D1Database,
    now: number,
    idleSeconds: number,
): Promise<number> => {
    const result = await db
        .prepare(
            `DELETE FROM schedule_credentials
             WHERE updated_at < ? AND ${NO_ACTIVE_SCHEDULE}`,
        )
        .bind(now - idleSeconds)
        .run()
    return changesOf(result)
}

/** 予約がないまま、この秒数だけ使われなかった認証情報を削除する（30日） */
export const CREDENTIAL_IDLE_SECONDS = 30 * 24 * 60 * 60
