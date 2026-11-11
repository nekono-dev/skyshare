/** OAuth 認可の途中状態を暗号化して一度だけ使える形で保管する。 */
import type { D1Database } from "@/lib/platform/cfTypes"
import { decryptToken, encryptToken } from "@/lib/schedule/credentialCrypto"
import { changesOf } from "./rows"

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
