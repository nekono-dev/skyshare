// @ts-check
import { defineConfig, sessionDrivers } from "astro/config"
import cloudflare from "@astrojs/cloudflare"
import basicSsl from "@vitejs/plugin-basic-ssl"
import { oauthLoopbackForwarder } from "./hack/oauthLoopbackForwarder.ts"

import react from "@astrojs/react"
import partytown from "@astrojs/partytown"
import { loadEnv } from "vite"
import { checkSiteEnv, siteUrl } from "./src/lib/site/siteEnv.ts"

// astro dev サーバーは HTTPS 化のため vite-plugin-basic-ssl 経由で
// Node の http2 secure server を使う（Vite が https 設定時に自動選択するため）。
// このとき Astro の CSRF 対策ミドルウェア（security.checkOrigin）が
// リクエストURLのポート番号を http2 の :authority から正しく復元できず、
// 同一オリジンからの multipart/form-data POST まで
// 「Cross-site POST form submissions are forbidden」として弾いてしまう
// （Astro/Vite 側の http2 対応の不具合）。本番ビルドは Cloudflare Workers
// ランタイム上で動作しこの問題の対象外のため、dev サーバーのみ無効化する。
const isDevServer = process.argv.includes("dev")

// 運用者ごとに変わる値は環境変数で受け取る（DEVELOP.md の「運用者ごとの設定」）。
// `.env` も読むため vite の loadEnv を使う。シェルの環境変数が優先される
const env = { ...loadEnv("production", process.cwd(), ""), ...process.env }
// 本番ビルドでは、運営者情報などの必須値が欠けたまま公開しないよう、ビルドを止める
if (process.argv.includes("build")) {
  const problems = checkSiteEnv(env)
  if (problems.length > 0) {
    throw new Error(
      `運用者ごとの設定に不備があります:\n- ${problems.join("\n- ")}`,
    )
  }
}

export default defineConfig({
  output: "server",
  adapter: cloudflare({ imageService: "compile" }),
  // 公開するドメイン（SITE_HOST）。開発時に未設定なら開発サーバーのアドレスを使う
  site: siteUrl(env),
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
    // basicSsl: 開発サーバーの https 化。oauthLoopbackForwarder: Bluesky の OAuth の開発用の公開クライアントの
    // 戻り先（http://127.0.0.1:4322/oauth/callback/）を開発サーバーへ中継する（開発サーバーでだけ動く）
    plugins: [basicSsl(), oauthLoopbackForwarder()],
    server: {
      https: true,
    },
  },

  // GAタグ(type="text/partytown")をWeb Worker上で実行するため Partytown を導入する。
  // gtag は dataLayer 経由で動作するため、forward に gtag を指定する
  integrations: [
    react(),
    partytown({ config: { forward: ["dataLayer.push"] } }),
  ],
})
