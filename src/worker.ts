/**
 * Worker のエントリ。
 *
 * 責務と処理概要:
 * - 画面と API のリクエスト（fetch）は、Astro のアダプタが提供するハンドラに任せる。
 * - Cron Trigger による定期実行（scheduled）で、実行時刻が到来した予約投稿を毎分実行し、
 *   1日1回（`isHousekeepingTime`）だけ終了した予約と不要な認証情報の後片付けを行う。
 *   scheduled は Cloudflare のプラットフォームだけが呼び、HTTP の経路から到達できない。
 */
import { handle } from "@astrojs/cloudflare/handler"
import type { ScheduleEnv } from "@/lib/schedule/cfTypes"
import {
    isHousekeepingTime,
    runHousekeeping,
    runScheduledPosts,
} from "@/lib/schedule/runner"

export default {
    fetch: handle,
    async scheduled(
        event: { scheduledTime: number },
        env: ScheduleEnv,
        ctx: { waitUntil: (promise: Promise<unknown>) => void },
    ) {
        const now = Math.floor(Date.now() / 1000)
        ctx.waitUntil(runScheduledPosts(env, now))
        if (isHousekeepingTime(Math.floor(event.scheduledTime / 1000))) {
            ctx.waitUntil(runHousekeeping(env, now))
        }
    },
}
