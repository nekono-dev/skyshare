/**
 * Astroコンポーネント（`.astro`）の描画テスト用の vitest 設定。
 *
 * 責務と処理概要:
 * - `tests/astro/**` の `*.test.ts` だけを対象に、Astro の Container API で `.astro` を
 *   サーバー描画して出力のHTMLを検証する。
 * - `.astro` の変換には Astro の Vite 設定が要るため `getViteConfig` を使う。
 *   Cloudflareアダプタは vitest 上で起動できないため `astro.config.mjs` は読み込まず、
 *   React のインテグレーションだけを指定する。
 * - 通常の単体テスト（`vitest.config.ts`）は Astro に依存しない構成のまま保ち、このディレクトリを除外する。
 */
import react from "@astrojs/react"
import { getViteConfig } from "astro/config"
import path from "node:path"

export default getViteConfig(
    {
        resolve: {
            alias: { "@": path.resolve(import.meta.dirname, "./src") },
        },
        test: {
            environment: "node",
            include: ["tests/astro/**/*.test.ts"],
        },
    } as never,
    {
        configFile: false,
        site: "https://skyshare.nekono.dev",
        trailingSlash: "always",
        integrations: [react()],
    } as never,
)
