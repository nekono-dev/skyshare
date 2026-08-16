// @ts-check
import { defineConfig, sessionDrivers } from "astro/config"
import cloudflare from "@astrojs/cloudflare"

import react from "@astrojs/react"

export default defineConfig({
  output: "server",
  adapter: cloudflare({ imageService: "compile" }),
  site: "https://preview.skyshare.nekono.dev",
  server: {
    port: 4321,
    host: true,
  },
  trailingSlash: "always",
  session: {
    driver: sessionDrivers.lruCache({
      max: 1000,
    }),
  },
  // Vite 固有の設定を乗せて、いくつかのビルド時警告を抑制する
  vite: {
    // バンドルが大きくなる旨の警告上限を引き上げる
    build: {
      chunkSizeWarningLimit: 1000,
    },
    // Vite の最適化設定: 古い `esbuild` ベースのオプションを参照するプラグイン
    // があるため、rollup 形式のオプションを明示的に指定しておく
    optimizeDeps: {
      rollupOptions: {},
    },
    // 新しい選択肢である oxc を空のオブジェクトで用意しておく（互換性援助）
    oxc: {},
  },

  integrations: [react()],
})
