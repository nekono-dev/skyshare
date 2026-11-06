/**
 * render 層（`.astro` ページのサーバー描画）の vitest 設定。
 *
 * 責務と処理概要:
 * - `tests/render` 配下の `*.test.ts` を、Astro の Container API で `.astro` をサーバー描画して検証する。
 * - `.astro` の変換には Astro の Vite 設定が要るため `getViteConfig` を使う。
 *   Cloudflare アダプタは vitest 上で起動できないため `astro.config.mjs` は読まず、
 *   React のインテグレーションだけを指定する。
 * - 他の層（unit・component・route）とは別の設定で実行する。
 */
import react from "@astrojs/react"
import { getViteConfig } from "astro/config"
import path from "node:path"

export default getViteConfig(
    {
        resolve: {
            alias: { "@": path.resolve(import.meta.dirname, "../../src") },
        },
        test: {
            environment: "node",
            include: ["tests/render/**/*.test.ts"],
        },
    } as never,
    {
        configFile: false,
        site: "https://skyshare.nekono.dev",
        trailingSlash: "always",
        integrations: [react()],
    } as never,
)
