/**
 * 予約用の認証情報の保管・状態・未使用の認証情報の印への置き換え（トークンは暗号化して保管）。
 *
 * 責務と処理概要:
 * - 認証情報（リフレッシュトークン）を暗号化してアカウントごとに1件保管し、復号して読む。
 * - 登録の状態・最後の使用と許可の時刻を返し、使用の時刻を更新し、削除する。
 * - 待機中・実行中の予約が無い未使用の認証情報を印に替え、古い印を削除する。
 */
import type { D1Database } from "@/lib/platform/cfTypes"
import { decryptToken, encryptToken } from "@/lib/schedule/credentialCrypto"
import { changesOf } from "./rows"

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
