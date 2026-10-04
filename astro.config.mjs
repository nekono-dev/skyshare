// @ts-check
import { defineConfig, sessionDrivers } from "astro/config"
import cloudflare from "@astrojs/cloudflare"
import basicSsl from "@vitejs/plugin-basic-ssl"

import react from "@astrojs/react"

// astro dev サーバーは HTTPS 化のため vite-plugin-basic-ssl 経由で
// Node の http2 secure server を使う（Vite が https 設定時に自動選択するため）。
// このとき Astro の CSRF 対策ミドルウェア（security.checkOrigin）が
// リクエストURLのポート番号を http2 の :authority から正しく復元できず、
// 同一オリジンからの multipart/form-data POST まで
// 「Cross-site POST form submissions are forbidden」として弾いてしまう
// （Astro/Vite 側の http2 対応の不具合）。本番ビルドは Cloudflare Workers
// ランタイム上で動作しこの問題の対象外のため、dev サーバーのみ無効化する。
const isDevServer = process.argv.includes("dev")

export default defineConfig({
  output: "server",
  adapter: cloudflare({ imageService: "compile" }),
  site: "https://skyshare.nekono.dev",
  server: {
    port: 4321,
    host: true,
  },
  security: {
    checkOrigin: !isDevServer,
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
      // dev 起動後に astro/app/manifest が遅延発見されると SSR 依存の再最適化が走り、
      // workerd 側が参照中の旧チャンク（sequence-*.js 等）が削除されて
      // 「The file does not exist at ... deps_ssr」で落ちる。
      // 事前バンドル対象に含めて再最適化自体を発生させない。
      // （@astrojs/cloudflare がユーザー指定の include を ssr 環境へ引き継ぐ）
      include: ["astro/app/manifest", "astro/logger/json"],
    },
    // 新しい選択肢である oxc を空のオブジェクトで用意しておく（互換性援助）
    oxc: {},
    // 自己署名証明書で dev サーバーを HTTPS 化する（Web Share API はセキュアコンテキスト必須のため）
    plugins: [basicSsl()],
    server: {
      https: true,
    },
  },

  integrations: [react()],
})
