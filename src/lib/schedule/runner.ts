/**
 * 定期実行（Cron Trigger）1回分の流れ。
 *
 * 責務と処理概要:
 * 1. 停止した実行中の予約を待機中へ戻す。
 * 2. 実行時刻が到来した待機中の予約を、実行時刻の早い順に最大 CLAIM_LIMIT 件取り出す。
 * 3. 取り出した順に実行する。外部への通信の予算は全体で共有し、予算が尽きるか
 *    レート制限を受けたら、残りの予約は実行せず進捗を保ったまま待機中へ戻す。
 *
 * 後片付け（`runHousekeeping`）は毎分の流れから切り離し、1日1回だけ行う。
 * - 終了から保持期間を過ぎた予約を削除し、残っている画像を削除する。
 * - 予約がなく、最後の使用から30日を過ぎた認証情報を印に替え、古い印と認可の途中の状態を削除する。
 * 保持期間は日単位で、後片付けが最大1日遅れても意味が変わらない。毎分行うと、利用者数に比例する
 * 全件走査が D1 の無料枠の行の読み取りを消費するため、頻度を下げている。
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
 * 終了した予約と不要な認証情報・認可の途中の状態を削除する（1日1回）。
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
        await purgeReauthMarkers(env.DB, now, REAUTH_MARKER_KEEP_SECONDS)
        await purgeOAuthStates(env.DB, now)
    } catch {
        console.error("runHousekeeping: purge failed")
    }
}
