/**
 * Astro のミドルウェアエントリーポイント。
 *
 * このファイルの配置場所（`src/middleware.ts`）は Astro のビルドが自動走査する
 * 決め打ちのパスであり、変更できない。実装本体は各 `lib` 配下に置いているため、
 * ここでは合成するだけにとどめる。
 * - `localeMiddleware`: 表示言語を `locals.locale` に供給する（`lib/i18n/middleware.ts`）
 * - `refreshBskySession`: bsky セッションの再開・ローテーション書き戻し（`lib/session/bskySessionRefresh.ts`）
 */
import { sequence } from "astro:middleware"
import { localeMiddleware } from "@/lib/i18n/middleware"
import { refreshBskySession } from "@/lib/session/bskySessionRefresh"

export const onRequest = sequence(localeMiddleware, refreshBskySession)
