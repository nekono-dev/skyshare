/**
 * Worker のエントリ。
 *
 * 責務と処理概要:
 * - 画面と API のリクエスト（fetch）は、Astro のアダプタが提供するハンドラに任せる。
 * - Cron Trigger による定期実行（scheduled）で、実行時刻が到来した予約投稿を実行する。
 *   scheduled は Cloudflare のプラットフォームだけが呼び、HTTP の経路から到達できない。
 */
import { handle } from "@astrojs/cloudflare/handler"
import type { ScheduleEnv } from "@/lib/schedule/cfTypes"
import { runScheduledPosts } from "@/lib/schedule/runner"

export default {
    fetch: handle,
    async scheduled(
        _event: unknown,
        env: ScheduleEnv,
        ctx: { waitUntil: (promise: Promise<unknown>) => void },
    ) {
        ctx.waitUntil(runScheduledPosts(env, Math.floor(Date.now() / 1000)))
    },
}
