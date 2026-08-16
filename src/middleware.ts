/**
 * Astro のミドルウェアエントリーポイント。
 *
 * このファイルの配置場所（`src/middleware.ts`）は Astro のビルドが自動走査する
 * 決め打ちのパスであり、変更できない。実装本体は `src/lib/bskySessionRefresh.ts` に
 * 置いているため、ここでは re-export するだけにとどめる。
 */
export { refreshBskySession as onRequest } from "@/lib/session/bskySessionRefresh"
