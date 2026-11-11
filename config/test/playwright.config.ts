/**
 * Playwright configuration for browser-based end-to-end tests.
 * The Astro dev server daemonizes, so start it separately instead of using Playwright's `webServer`.
 * Guest mode exercises UI state without requiring a real Bluesky account.
 */
import { defineConfig, devices } from "@playwright/test"

export default defineConfig({
    // Run the six guest user flows; live account checks use a separate configuration.
    testDir: "../../tests/e2e/flows",
    // 失敗時の出力（スクリーンショット・トレース）は生成物のキャッシュへ書く
    outputDir: "../../.cache/test-results",
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
        // English-locale tests override this with `test.use({ locale: "en-US" })`.
        locale: "ja-JP",
        trace: "on-first-retry",
    },
    projects: [
        {
            name: "chromium",
            use: { ...devices["Desktop Chrome"] },
        },
        // Limit secondary browsers to features with browser-specific behavior: dropdowns and video playback.
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
    ],
})
