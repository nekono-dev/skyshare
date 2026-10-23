/**
 * 予約用の許可の有効期限の目安の計算。
 *
 * 責務と処理概要:
 * - 認可サーバーはトークンの応答で更新用トークンの期限を返さないため、期限を次の早い方で見積もる。
 *   - 本サービスが未使用の許可を消す時点: 最後の使用（予約の作成・変更・実行）から30日。
 *     待機中の予約があれば、その実行で使われるため、最も遅い実行時刻から数える。
 *   - Bluesky の認可サーバー（atproto の参照実装）が confidential client の許可を失効させる時点:
 *     許可から2年（`SESSION_LIFETIME_EXTENDED`）。
 *     最後の更新から3か月（`REFRESH_LIFETIME_EXTENDED`）の失効は、30日の方が先に来るため考えない。
 * - Bluesky の設定での取消など、事前に分からない失効は含まない（目安であることを画面に示す）。
 */
import { CREDENTIAL_IDLE_SECONDS } from "./store"

/** 認可サーバーが confidential client の許可を保つ最長の秒数（2年。365.25日を1年とする） */
export const AUTHORIZATION_LIFETIME_SECONDS = Math.floor(2 * 365.25 * 86400)

/**
 * 許可の有効期限の目安（UNIX 秒）を返す。
 *
 * Input:
 * - `authorizedAt`: 許可を得た時刻
 * - `updatedAt`: 最後の使用の時刻
 * - `latestRunAt`: 待機中・実行中の予約の最も遅い実行時刻。無ければ null
 *
 * Example: `estimateCredentialExpiry({ authorizedAt: 0, updatedAt: 100, latestRunAt: null })`
 *   → `100 + 30日`
 */
export const estimateCredentialExpiry = (s: {
    authorizedAt: number
    updatedAt: number
    latestRunAt: number | null
}): number => {
    const lastUse = Math.max(s.updatedAt, s.latestRunAt ?? 0)
    return Math.min(
        lastUse + CREDENTIAL_IDLE_SECONDS,
        s.authorizedAt + AUTHORIZATION_LIFETIME_SECONDS,
    )
}
