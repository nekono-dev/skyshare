/**
 * route 層（API ルートと D1・R2 の binding）の vitest 設定。workerd で実行する。
 *
 * 責務と処理概要:
 * - `tests/route` 配下の `*.test.ts` を、`@cloudflare/vitest-plugin` で workerd 上に実行する。
 * - 設定は `tests/route/wrangler.jsonc`（テスト用）から読む。本番の生成物（`wrangler.jsonc`）は読まない。
 * - マイグレーションは `migrations/` から読み、各テストの前に D1 へ適用する。
 * - 互換日付は、同梱の workerd が対応する最新の値を使う。本番（`config/wrangler.template.jsonc`）と
 *   値が違えば、設定の読み込み時に警告を出す（要件 11.3）。差の内容は steering に記録する（要件 11.2）。
 * - workerd からの外部通信は `fakeOutbound`（偽の Bluesky の応答）へ向ける。実ネットワークへは出ない。
 * - 分岐カバレッジは istanbul で計測する（workerd では v8 を使わない）。
 */
import path from "node:path"
import { fileURLToPath } from "node:url"
import { readFileSync } from "node:fs"
import { cloudflareTest, readD1Migrations } from "@cloudflare/vitest-plugin"
import { defineConfig } from "vitest/config"
import { fakeOutbound } from "../../tests/support/fakeOutbound"

// この設定は config/test/ にあるため、プロジェクトの根は 2 階層上になる
const rootDir = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "../..",
)
const migrations = await readD1Migrations(path.join(rootDir, "migrations"))

/** 指定の JSONC ファイルの compatibility_date を返す（コメントを含むため正規表現で読む） */
const readCompatibilityDate = (file: string): string | undefined =>
    readFileSync(path.join(rootDir, file), "utf8").match(
        /"compatibility_date"\s*:\s*"([^"]+)"/,
    )?.[1]

const routeDate = readCompatibilityDate("tests/route/wrangler.jsonc")
const productionDate = readCompatibilityDate("config/wrangler.template.jsonc")
if (routeDate !== productionDate) {
    console.warn(
        `[route] 互換日付が本番と異なります（route: ${routeDate}、本番: ${productionDate}）。差は steering/testing.md に記録する。`,
    )
}

export default defineConfig({
    root: rootDir,
    plugins: [
        cloudflareTest({
            wrangler: { configPath: "./tests/route/wrangler.jsonc" },
            miniflare: {
                bindings: { TEST_MIGRATIONS: migrations },
                // route 層の外部通信は偽の Bluesky の応答へ向ける（実ネットワークへは出さない）
                outboundService: fakeOutbound,
            },
        }),
    ],
    resolve: {
        alias: { "@": path.resolve(rootDir, "./src") },
    },
    test: {
        include: ["tests/route/**/*.test.ts"],
        setupFiles: ["./tests/route/support/applyMigrations.ts"],
        // workerd の初回の動的 import（大きなライブラリの変換）は、並列実行時に 5 秒を超えることがある
        testTimeout: 30_000,
        // P0 の route 層モジュール（要件 4.1）。閾値はファイル単位の分岐 80%
        coverage: {
            enabled: true,
            provider: "istanbul",
            reportsDirectory: path.resolve(rootDir, ".cache/coverage"),
            include: [
                "src/lib/session/oauthSession.ts",
                "src/lib/session/bskySessionRefresh.ts",
                "src/lib/session/oauthLogin.ts",
                "src/lib/schedule/executor.ts",
                "src/lib/schedule/runner.ts",
                "src/lib/schedule/stageSchedule.ts",
                "src/lib/schedule/imageStaging.ts",
                "src/lib/survey/store.ts",
                "src/lib/survey/retention.ts",
                "src/lib/survey/request.ts",
                "src/pages/v1/page.ts",
                "src/pages/v2/feedback.ts",
            ],
            thresholds: {
                "src/lib/session/oauthSession.ts": { branches: 80 },
                "src/lib/session/bskySessionRefresh.ts": { branches: 80 },
                "src/lib/session/oauthLogin.ts": { branches: 80 },
                "src/lib/schedule/executor.ts": { branches: 80 },
                "src/lib/schedule/runner.ts": { branches: 80 },
                "src/lib/schedule/stageSchedule.ts": { branches: 80 },
                "src/lib/schedule/imageStaging.ts": { branches: 80 },
                "src/lib/survey/store.ts": { branches: 80 },
                "src/lib/survey/retention.ts": { branches: 80 },
                "src/lib/survey/request.ts": { branches: 80 },
                "src/pages/v1/page.ts": { branches: 80 },
                "src/pages/v2/feedback.ts": { branches: 80 },
            },
        },
    },
})
