/**
 * 予約用認可の期限を、トークン応答に更新用トークンの期限が無い認可サーバー向けに見積もる。
 *
 * - 最後の使用から30日と Bluesky の confidential client 許可の2年期限の早い方を返す。待機中の予約があれば最も遅い実行時刻を使用時刻とする。
 * - 事前に分からない失効（Bluesky 設定での取消など）は含めず、結果は画面に目安として示す。
 * - 更新から3か月の失効は、30日の未使用期限が先に来るため見積もりに含めない。
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
