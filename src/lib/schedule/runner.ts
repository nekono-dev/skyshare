/**
 * 定期実行（Cron Trigger）1回分の流れ。
 *
 * 責務と処理概要:
 * 1. 停止した実行中の予約を待機中へ戻す。
 * 2. 実行時刻が到来した待機中の予約を、実行時刻の早い順に最大 CLAIM_LIMIT 件取り出す。
 * 3. 取り出した順に実行する。外部への通信の予算は全体で共有し、予算が尽きるか
 *    レート制限を受けたら、残りの予約は実行せず進捗を保ったまま待機中へ戻す。
 * 4. 終了から保持期間を過ぎた予約を削除し、残っている画像を削除する。
 * 5. 予約がなく、最後の使用から30日を過ぎた認証情報を削除する。
 *
 * 実装上の制約:
 * - atproto のライブラリを読み込まない。1件の失敗で実行全体を止めない。
 */
import type { ScheduleEnv } from "./cfTypes"
import { executeSchedule } from "./executor"
import { removeImages } from "./imageStaging"
import {
    CREDENTIAL_IDLE_SECONDS,
    FINISHED_RETENTION_SECONDS,
    STALE_SECONDS,
    claimDueSchedules,
    parseKeys,
    purgeFinished,
    purgeIdleCredentials,
    purgeReauthMarkers,
    REAUTH_MARKER_KEEP_SECONDS,
    purgeOAuthStates,
    releaseSchedule,
    requeueStale,
} from "./store"
import { CLAIM_LIMIT } from "./types"
import { createBudget } from "./xrpcClient"

/** 1回の実行で行う外部への通信の上限（Workers 無料枠の上限の内側に収める） */
export const MAX_EXTERNAL_CALLS = 40

export const runScheduledPosts = async (
    env: ScheduleEnv,
    now: number,
    fetchImpl: typeof fetch = fetch,
): Promise<void> => {
    if (!env.SCHEDULE_ENC_KEY) {
        console.error("runScheduledPosts: SCHEDULE_ENC_KEY is not set")
        return
    }

    let claimed
    try {
        await requeueStale(env.DB, now, STALE_SECONDS)
        claimed = await claimDueSchedules(env.DB, now, CLAIM_LIMIT)
    } catch {
        console.error("runScheduledPosts: claim failed")
        return
    }

    const budget = createBudget(MAX_EXTERNAL_CALLS)
    let stopped = false
    for (const row of claimed) {
        try {
            if (stopped) {
                await releaseSchedule(env.DB, row.id, false, now)
                continue
            }
            await executeSchedule(env, budget, row, now, fetchImpl)
            if (budget.remaining <= 0 || budget.rateLimited) stopped = true
        } catch {
            // 分類できない例外は一時的な失敗として扱い、次の定期実行で再試行する
            console.error(`runScheduledPosts: unexpected error id=${row.id}`)
            await releaseSchedule(env.DB, row.id, true, now).catch(() => {})
        }
    }

    try {
        const purged = await purgeFinished(
            env.DB,
            now,
            FINISHED_RETENTION_SECONDS,
        )
        for (const row of purged) {
            await removeImages(
                env.SCHEDULE_IMAGES,
                parseKeys(row.imageKeys),
            ).catch(() => {})
        }
        await purgeIdleCredentials(env.DB, now, CREDENTIAL_IDLE_SECONDS)
        await purgeReauthMarkers(env.DB, now, REAUTH_MARKER_KEEP_SECONDS)
        await purgeOAuthStates(env.DB, now)
    } catch {
        console.error("runScheduledPosts: purge failed")
    }
}
