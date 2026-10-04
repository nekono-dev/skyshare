/**
 * Playwright（ヘッドレスブラウザでのe2eテスト）設定。
 *
 * 責務と処理概要:
 * - `.claude/skills/spec-driven-development/SKILL.md`が定める「UI実装の検証には
 *   Playwrightによるヘッドレスブラウザでの実動作確認を必須とする」方針を実行するための
 *   最小構成。
 * - `https://localhost:4321`（`astro dev`、`astro.config.mjs`参照。dev サーバーは
 *   HTTPS必須）に対してテストする。
 * - ログイン不要のゲスト表示（`?guest`クエリ、`src/lib/guestMode.ts`）を使うことで、
 *   実Blueskyアカウントを必要とせずUIの状態遷移を検証できる。
 *
 * `webServer`（Playwrightによる自動起動）を使わない理由:
 * - このプロジェクトが使うAstroバージョンの`astro dev`は、起動後に検知用の子プロセスを
 *   終了させて常駐デーモン化する（`astro dev stop`/`status`/`logs`で管理する方式）。
 *   Playwrightの`webServer`はコマンドが起動後もフォアグラウンドで存続し続けることを
 *   前提とするため、この方式と噛み合わず「起動直後にプロセスが終了した」という
 *   誤判定でテストが失敗する。そのため、devサーバーは`npm run dev`で別途起動して
 *   から`npm run test:e2e`を実行する運用とする。
 */
import { defineConfig, devices } from "@playwright/test"

export default defineConfig({
    testDir: "./tests/e2e",
    // Astro dev サーバー(Vite)はオンデマンドコンパイルのため、並列ワーカーから
    // 同時にヒットすると初回コンパイルが競合し遅延する。開発用サーバー1台構成の
    // 現状ではworkersを1に固定する。
    workers: 1,
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 2 : 0,
    reporter: "list",
    timeout: 30_000,
    expect: { timeout: 10_000 },
    use: {
        baseURL: "https://localhost:4321",
        ignoreHTTPSErrors: true,
        trace: "on-first-retry",
    },
    projects: [
        {
            name: "chromium",
            use: { ...devices["Desktop Chrome"] },
        },
    ],
})
