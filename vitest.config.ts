/**
 * vitest 設定。
 *
 * 責務と処理概要:
 * - `src/lib/*` `src/util/*`、および React に依存しない純粋関数を切り出した
 *   コンポーネント内モジュール（例: `src/components/PostForm/shareTogglesReducer.ts`）の
 *   単体テストを Node 環境で実行するための最小構成。
 * - テストコードはルートの `tests/` 配下に `src/` のディレクトリ構造を維持して配置する。
 * - Astro/Cloudflareアダプタ/Reactインテグレーションへは依存しないため、
 *   Astro の Vite 設定を丸ごと読み込まず、スタンドアロン構成にする。
 * - `tsconfig.json` の `paths` にある `@/*` エイリアスを解決する。
 * - `astro.config.mjs` の `site` 値（`import.meta.env.SITE`）をテスト用に固定する
 *   （`skyshareEntryUrlgen` 等が参照するため）。
 */
import { defineConfig } from "vitest/config"
import path from "node:path"
import { fileURLToPath } from "node:url"

const rootDir = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
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
        include: ["tests/**/*.test.ts"],
        coverage: {
            provider: "v8",
            include: [
                "src/lib/**",
                "src/util/**",
                "src/components/PostForm/shareTogglesReducer.ts",
                "src/components/CountedTextInput/autoGrowHeight.ts",
            ],
        },
    },
})
