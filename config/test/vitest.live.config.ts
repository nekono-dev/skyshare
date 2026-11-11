/**
 * Vitest configuration for read-only contract checks against a real Bluesky account.
 *
 * - Run only the live contract tests in Node; credentials are optional and missing credentials skip them.
 * - Invoke manually with `npm run test:live`; live account access is excluded from automated checks.
 */
import path from "node:path"
import { defineConfig } from "vitest/config"

// この設定は config/test/ にあるため、include の基準はプロジェクトの根にする
export default defineConfig({
    root: path.resolve(import.meta.dirname, "../.."),
    test: {
        environment: "node",
        include: ["tests/live/**/*.test.ts"],
        // 実 PDS への通信を待つ時間
        testTimeout: 30_000,
        coverage: { enabled: false },
    },
})
