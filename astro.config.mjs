// @ts-check
import { defineConfig, sessionDrivers } from "astro/config"
import cloudflare from "@astrojs/cloudflare"
import basicSsl from "@vitejs/plugin-basic-ssl"
import { oauthLoopbackForwarder } from "./scripts/dev/oauth-loopback-forwarder.ts"

import react from "@astrojs/react"
import partytown from "@astrojs/partytown"
import { checkSiteEnv, siteUrl } from "./src/lib/site/siteEnv.ts"
import { resolveBuildInfo } from "./src/lib/site/buildEnv.ts"
import { surveyConfigPresentFlag } from "./src/lib/site/surveyPresence.ts"
import { surveyResultsReadableFlag } from "./src/lib/site/surveyResultsReadable.ts"
import { execFileSync } from "node:child_process"
import { existsSync, readFileSync } from "node:fs"
import { parseJsonc } from "./scripts/lib/jsonc.mjs"

// astro dev サーバーは HTTPS 化のため vite-plugin-basic-ssl 経由で
// Node の http2 secure server を使う（Vite が https 設定時に自動選択するため）。
// このとき Astro の CSRF 対策ミドルウェア（security.checkOrigin）が
// リクエストURLのポート番号を http2 の :authority から正しく復元できず、
// 同一オリジンからの multipart/form-data POST まで
// 「Cross-site POST form submissions are forbidden」として弾いてしまう
// （Astro/Vite 側の http2 対応の不具合）。本番ビルドは Cloudflare Workers
// ランタイム上で動作しこの問題の対象外のため、dev サーバーのみ無効化する。
const isDevServer = process.argv.includes("dev")

// 非秘密の設定（運用者の値・公開するドメイン・接続先）は wrangler.jsonc の vars に一本化している。
// wrangler.jsonc は scripts/config/render-wrangler.mjs が config/ から生成し、開発・ビルド・実行時が同じ値を使う（docs/DEVELOP.md の「設定」）。
const wranglerPath = new URL("./wrangler.jsonc", import.meta.url)
if (!existsSync(wranglerPath)) {
  throw new Error(
    "wrangler.jsonc がありません。npm run setup:local（開発）か、CI の設定の生成を先に実行してください",
  )
}
const wrangler = parseJsonc(readFileSync(wranglerPath, "utf8"))
// 公開するドメインは配備の経路（routes）から得る。開発では経路が無いため未設定になる
const siteRoute = wrangler.routes?.[0]?.pattern
const env = {
  ...process.env,
  ...(wrangler.vars ?? {}),
  ...(siteRoute ? { SITE_HOST: siteRoute } : {}),
}
// 本番ビルドでは、運営者情報などの必須値が欠けたまま公開しないよう、ビルドを止める
if (process.argv.includes("build")) {
  const problems = checkSiteEnv(env)
  if (problems.length > 0) {
    throw new Error(
      `運用者ごとの設定に不備があります:\n- ${problems.join("\n- ")}`,
    )
  }
}

// 不具合の報告に載せる、ビルドしたコミットとソースコードのリポジトリ。
// CI では GITHUB_SHA・GITHUB_REPOSITORY を使い、手元では Git の値を読む（Git がなければ不明として続ける）
const readGit = (...args) => {
  try {
    return execFileSync("git", args, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim()
  } catch {
    return ""
  }
}
const build = resolveBuildInfo(env, {
  sha: readGit("rev-parse", "HEAD"),
  remoteUrl: readGit("remote", "get-url", "origin"),
})

// 配信用のアンケート設定と保存先の宣言が揃うとき "true"。
// 画面とサーバーは、この旗が "true" のときだけ設定を取得する（`src/lib/survey/loadConfig.ts`）
const surveyConfigPresent = surveyConfigPresentFlag(
  env,
  existsSync(new URL("./public/surveys/index.json", import.meta.url)),
  wrangler,
)
const surveyResultsReadable = surveyResultsReadableFlag(wrangler)

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
    // ビルドの情報を画面とサーバーの両方に埋め込む（`src/lib/site/buildInfo.ts` が参照する）
    define: {
      "import.meta.env.PUBLIC_COMMIT_SHA": JSON.stringify(build.commit ?? ""),
      "import.meta.env.PUBLIC_SOURCE_REPOSITORY": JSON.stringify(
        build.repository ?? "",
      ),
      "import.meta.env.PUBLIC_SURVEY_CONFIG_PRESENT":
        JSON.stringify(surveyConfigPresent),
      "import.meta.env.PUBLIC_SURVEY_RESULTS_READABLE": JSON.stringify(
        surveyResultsReadable,
      ),
    },
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
