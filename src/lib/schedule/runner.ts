/**
 * Cron Trigger 1 回分の予約投稿実行と、日次の後片付けを管理する。
 *
 * - Cron の経路は `@atproto/*` を読み込まず WebCrypto と fetch を使い、Workers Free の CPU 上限 10 ms に収める。
 * - 1 件の失敗で実行全体を止めず、通信予算の枯渇または rate limit 後は残りを進捗付きで待機へ戻す。
 * - 後片付けは日次で行う。毎分の全件走査は利用者数に比例して D1 Free の行読み取り枠を消費する。
 */
import type { ScheduleEnv } from "@/lib/platform/cfTypes"
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
}

/** 後片付けを行う時刻（UTC の 0 時からの分）。日本時間の午前 3 時 */
export const HOUSEKEEPING_MINUTE_OF_DAY_UTC = 18 * 60

/**
 * 後片付けを行う定期実行か。1日のうち、この分に起動された1回だけが真になる。
 * 状態を持たないため、その分の起動が失敗しても翌日の同じ分に回収される（削除はすべて期限での絞り込み）。
 *
 * Input: `now`（UNIX 秒。定期実行の予定時刻）
 * Output: 後片付けの分なら true
 * Example: 18:00:20 UTC → true、18:01:00 UTC → false
 */
export const isHousekeepingTime = (now: number): boolean =>
    Math.floor(now / 60) % (24 * 60) === HOUSEKEEPING_MINUTE_OF_DAY_UTC

/**
 * 終了した予約と未使用の認証情報を削除する（1日1回）。
 * 1件の失敗で止めず、失敗は記録だけする。
 */
export const runHousekeeping = async (
    env: ScheduleEnv,
    now: number,
): Promise<void> => {
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
        await purgeOAuthStates(env.DB, now)
    } catch {
        console.error("runHousekeeping: purge failed")
    }
}
