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
import { LIVE_STORAGE_STATE, loadLiveAccount } from "./tests/e2e/live/env"

// 検証用アカウントの認証情報があるときだけ、実アカウントE2E（ライブテスト）を有効にする
// （`specs/e2elive/design.md §3`）。無ければprojectごと存在しない。
const liveEnabled = loadLiveAccount() !== null

export default defineConfig({
    testDir: "./tests/e2e",
    // Astro dev サーバー(Vite)はオンデマンドコンパイルのため、並列ワーカーから
    // 同時にヒットすると初回コンパイルが競合し遅延する。開発用サーバー1台構成の
    // 現状ではworkersを1に固定する。
    workers: 1,
    forbidOnly: !!process.env.CI,
    // 実行環境のネットワーク変動（net::ERR_NETWORK_CHANGED・chrome-error）による一過性の失敗を吸収する
    retries: 2,
    reporter: "list",
    timeout: 30_000,
    expect: { timeout: 10_000 },
    use: {
        baseURL: "https://localhost:4321",
        ignoreHTTPSErrors: true,
        // 表示言語の自動判定（navigator.languages / Accept-Language）を日本語に固定し、
        // 日本語表示を前提とする既存E2Eが実行環境のロケールに左右されないようにする。
        // 英語環境のテストは spec 側で `test.use({ locale: "en-US" })` を指定する。
        locale: "ja-JP",
        trace: "on-first-retry",
    },
    projects: [
        {
            name: "chromium",
            testIgnore: /live\/|\.ios\.spec\.ts$/,
            use: { ...devices["Desktop Chrome"] },
        },
        // 他ブラウザ・iPhoneエミュレーション（WebKit）での確認。Chromiumで検証済みの全specを
        // 流すのではなく、ブラウザ差が出る機能（Dropdown・動画再生）のspecに限定する
        // （`specs/e2elive`ではなく各機能のspecの手動確認項目に対応する）。
        {
            name: "firefox",
            testMatch: /(dropdown|videoDisplay|videoLimits)\.spec\.ts$/,
            use: { ...devices["Desktop Firefox"] },
        },
        {
            name: "webkit",
            testMatch: /(dropdown|videoDisplay)\.spec\.ts$/,
            use: { ...devices["Desktop Safari"] },
        },
        {
            name: "webkit-iphone",
            testMatch: /(dropdown|videoDisplay)\.spec\.ts$|\.ios\.spec\.ts$/,
            use: { ...devices["iPhone 13"] },
        },
        ...(liveEnabled
            ? [
                  {
                      name: "live-setup",
                      testMatch: /live\/auth\.setup\.ts/,
                      use: { ...devices["Desktop Chrome"] },
                  },
                  {
                      name: "live",
                      testMatch: /live\/.*\.spec\.ts/,
                      dependencies: ["live-setup"],
                      use: {
                          ...devices["Desktop Chrome"],
                          storageState: LIVE_STORAGE_STATE,
                      },
                  },
              ]
            : []),
    ],
})
