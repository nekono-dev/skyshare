/**
 * Vitest configuration for pure unit tests.
 *
 * Tests run in Node without Astro, Cloudflare, or DOM dependencies.
 * Istanbul measures branch coverage consistently because workerd does not support V8 coverage.
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
        // Each cookie module must meet 80% branch coverage independently; index.ts only re-exports.
        coverage: {
            enabled: true,
            provider: "istanbul",
            reportsDirectory: path.resolve(rootDir, ".cache/coverage"),
            include: [
                "src/lib/session/cookies/codec.ts",
                "src/lib/session/cookies/model.ts",
                "src/lib/session/cookies/pool.ts",
                "src/lib/session/cookies/headers.ts",
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
                "src/lib/session/cookies/codec.ts": { branches: 80 },
                "src/lib/session/cookies/model.ts": { branches: 80 },
                "src/lib/session/cookies/pool.ts": { branches: 80 },
                "src/lib/session/cookies/headers.ts": { branches: 80 },
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
