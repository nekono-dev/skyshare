/**
 * unit 層（純粋な規則）の vitest 設定。
 *
 * 責務と処理概要:
 * - `tests/unit` 配下の `*.test.ts` を Node 環境で実行する。
 * - 対象は `src/` の純粋な規則。Astro・Cloudflare・DOM に依存しない。
 * - `@` のエイリアスを `src` に解決する。
 * - `.astro` の描画は render 層（`vitest.astro.config.ts`）、API ルートは route 層、
 *   DOM を使う部品は component 層で実行する。
 * - 分岐カバレッジの計測は istanbul を使う（v8 は workerd で使わないため、層の間で統一する）。
 */
import path from "node:path"
import { fileURLToPath } from "node:url"
import { defineConfig } from "vitest/config"

// この設定は config/test/ にあるため、プロジェクトの根は 2 階層上になる
const rootDir = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "../..",
)

export default defineConfig({
    root: rootDir,
    resolve: {
        alias: {
            "@": path.resolve(rootDir, "./src"),
        },
    },
    define: {
        "import.meta.env.SITE": JSON.stringify("https://skyshare.nekono.dev"),
    },
    test: {
        environment: "node",
        include: ["tests/unit/**/*.test.ts"],
        // P0 の unit 層モジュール（要件 4.1）。閾値はファイル単位の分岐 80%
        coverage: {
            enabled: true,
            provider: "istanbul",
            reportsDirectory: path.resolve(rootDir, ".cache/coverage"),
            include: [
                "src/lib/session/cookies.ts",
                "src/lib/schedule/credentialCrypto.ts",
                "src/lib/survey/respondentHash.ts",
                "src/lib/entry/createBskyThread.ts",
                "src/lib/entry/resolveEntryDeleteScope.ts",
                "src/lib/entry/resolveDeleteTargets.ts",
                "src/lib/feedback/issueContent.ts",
                "src/lib/feedback/githubIssue.ts",
                "src/lib/i18n/locale.ts",
                "src/lib/share/shareBody.ts",
                "src/lib/share/counterReserve.ts",
            ],
            thresholds: {
                "src/lib/session/cookies.ts": { branches: 80 },
                "src/lib/schedule/credentialCrypto.ts": { branches: 80 },
                "src/lib/survey/respondentHash.ts": { branches: 80 },
                "src/lib/entry/createBskyThread.ts": { branches: 80 },
                "src/lib/entry/resolveEntryDeleteScope.ts": { branches: 80 },
                "src/lib/entry/resolveDeleteTargets.ts": { branches: 80 },
                "src/lib/feedback/issueContent.ts": { branches: 80 },
                "src/lib/feedback/githubIssue.ts": { branches: 80 },
                "src/lib/i18n/locale.ts": { branches: 80 },
                "src/lib/share/shareBody.ts": { branches: 80 },
                "src/lib/share/counterReserve.ts": { branches: 80 },
            },
        },
    },
})
