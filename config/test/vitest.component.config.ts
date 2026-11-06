/**
 * component 層（対話する React 部品）の vitest 設定。
 *
 * 責務と処理概要:
 * - `tests/component` 配下の `*.test.ts(x)` を実行する。既定は Node 環境で、
 *   DOM を使うファイルだけ先頭の `// @vitest-environment happy-dom` で指定する。
 * - 各テストの後に React Testing Library の `cleanup` を呼び、テスト間で DOM を残さない
 *   （`globals` を使わないため、自動のクリーンアップは効かない）。
 * - `@` のエイリアスを `src` に解決する。分岐カバレッジは istanbul で計測する。
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
