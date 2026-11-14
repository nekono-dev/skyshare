/**
 * Vitest configuration for API routes and D1/R2 bindings in workerd.
 *
 * - Use the test Wrangler config and migrations; outbound requests target a fake Bluesky service.
 * - Keep the compatibility date aligned with bundled workerd; warn when it differs from production.
 * - Istanbul measures branch coverage because workerd does not support V8 coverage.
 */
import path from "node:path"
import { fileURLToPath } from "node:url"
import { readFileSync } from "node:fs"
import { cloudflareTest, readD1Migrations } from "@cloudflare/vitest-plugin"
import { defineConfig } from "vitest/config"
import { fakeOutbound } from "../../tests/support/fakeOutbound"
import { parseJsonc } from "../../scripts/lib/jsonc.mjs"

// この設定は config/test/ にあるため、プロジェクトの根は 2 階層上になる
const rootDir = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "../..",
)
const migrations = await readD1Migrations(path.join(rootDir, "migrations"))

/** 指定の JSONC ファイルから文字列の compatibility_date を返す */
const readCompatibilityDate = (file: string): string | undefined => {
    const config: unknown = parseJsonc(
        readFileSync(path.join(rootDir, file), "utf8"),
    )
    if (typeof config !== "object" || config === null) return undefined
    const compatibilityDate = (config as { compatibility_date?: unknown })
        .compatibility_date
    return typeof compatibilityDate === "string" ? compatibilityDate : undefined
}

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
        // Each listed route module must meet 80% branch coverage independently.
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
                "src/lib/survey/daily.ts",
                "src/lib/survey/results/store.ts",
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
                "src/lib/survey/daily.ts": { branches: 80 },
                "src/lib/survey/results/store.ts": { branches: 80 },
                "src/lib/survey/request.ts": { branches: 80 },
                "src/pages/v1/page.ts": { branches: 80 },
                "src/pages/v2/feedback.ts": { branches: 80 },
            },
        },
    },
})
