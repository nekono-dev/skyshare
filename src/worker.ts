/**
 * Astro の HTTP ハンドラと Cloudflare Cron Trigger の処理を束ねる Worker。
 *
 * - `scheduled` はプラットフォームが Cron ごとに実行し、HTTP からは呼ばれない。
 * - 予約投稿を先に登録し、日次枠では後片付けとアンケート削除を独立して登録する。
 * - `waitUntil` を分け、一方の日次処理の失敗が他方へ伝播しないようにする。
 */
import { handle } from "@astrojs/cloudflare/handler"
import type { ScheduleEnv } from "@/lib/platform/cfTypes"
import {
    isHousekeepingTime,
    runHousekeeping,
    runScheduledPosts,
} from "@/lib/schedule/runner"
import {
    runSurveyRetention,
    type SurveyRetentionEnv,
} from "@/lib/survey/retention"

export default {
    fetch: handle,
    async scheduled(
        event: { scheduledTime: number },
        env: ScheduleEnv & Pick<SurveyRetentionEnv, "ASSETS">,
        ctx: { waitUntil: (promise: Promise<unknown>) => void },
    ) {
        const now = Math.floor(Date.now() / 1000)
        ctx.waitUntil(runScheduledPosts(env, now))
        if (isHousekeepingTime(Math.floor(event.scheduledTime / 1000))) {
            ctx.waitUntil(runHousekeeping(env, now))
            // 同期的な例外も他方へ波及させないよう、async 関数で包む
            ctx.waitUntil(
                (async () => runSurveyRetention(env, new Date(now * 1000)))(),
            )
        }
    },
}
