/**
 * Vitest configuration for interactive React components.
 *
 * - Tests use Node by default; DOM tests opt into happy-dom with a file-level environment directive.
 * - Explicit cleanup is required because Vitest globals are disabled; Istanbul measures branch coverage.
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
            // Astro の実行環境が無いため、遷移の関数は検証用の代わりに差し替える
            "astro:transitions/client": path.resolve(
                rootDir,
                "./tests/component/support/astroTransitions.ts",
            ),
        },
    },
    define: {
        "import.meta.env.SITE": JSON.stringify("https://skyshare.nekono.dev"),
    },
    test: {
        environment: "node",
        include: ["tests/component/**/*.test.{ts,tsx}"],
        setupFiles: ["./tests/component/support/setup.ts"],
        coverage: {
            provider: "istanbul",
            reportsDirectory: path.resolve(rootDir, ".cache/coverage"),
        },
    },
})
