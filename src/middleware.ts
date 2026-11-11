/**
 * Astro のリクエストに適用するミドルウェアを順序付ける。
 *
 * - 配置（`src/middleware.ts`）は Astro が自動走査する固定のパスで、変更できない。
 * - entry ページのキャッシュキーが表示言語を含むため、言語設定を先に実行する。
 */
import { sequence } from "astro:middleware"
import { localeMiddleware } from "@/lib/i18n/middleware"
import { entryPageCache } from "@/lib/entry/entryPageCache"
import { refreshBskySession } from "@/lib/session/bskySessionRefresh"

export const onRequest = sequence(
    localeMiddleware,
    entryPageCache,
    refreshBskySession,
)
