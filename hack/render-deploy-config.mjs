// CI/CD(GitHub Actions)用に、デプロイ設定ファイルを環境変数から生成するスクリプト。
//
// 責務:
// - wrangler.template.jsonc の vars と配備先（Worker 名・ドメイン・D1・R2）を環境変数の値で置き換え、wrangler.jsonc を生成する
//   （wrangler.jsonc は本番値を含むため .gitignore 対象。CIでは都度生成する）
// - 生成した wrangler.jsonc の workers_dev / preview_urls を、独自ドメインの有効状況に合わせて設定する
//   （branch-release-workflow スキルの wrangler-config。省略しない）
// - _legacy/frontend/.env.production を生成する（こちらも .gitignore 対象）
//
// 使い方: node hack/render-deploy-config.mjs [--staging]
// 必要な環境変数は DEVELOP.md の「運用者ごとの設定」を参照。
// 必須の環境変数が1つでも未設定/空の場合は、設定漏れによる誤デプロイを防ぐため異常終了する。
import { execFileSync } from "node:child_process"
import { readFileSync, writeFileSync } from "node:fs"

// wrangler.jsonc の vars に反映する環境変数（Cloudflare Worker の実行時変数）
const WRANGLER_VARS = [
  "PUBLIC_LEGACY_BACKEND_ENDPOINT",
  "PUBLIC_DEFAULT_ATP_SERVICE",
  "PUBLIC_NODE_ENV",
  "PUBLIC_OGP_EXTRACTOR_API",
  "PUBLIC_PLC_DIRECTORY_BASE_URL",
]

// wrangler.template.jsonc の配備先の値（運用者ごとに変わる）。
// [環境変数名, 既定値]。既定値が null のものは必須
const DEPLOY_VARS = [
  ["WORKER_NAME", "skyshare"],
  ["SITE_HOST", null],
  ["ZONE_NAME", null],
  ["SCHEDULE_D1_NAME", "skyshare-schedule"],
  ["SCHEDULE_D1_DATABASE_ID", null],
  ["SCHEDULE_R2_BUCKET", "skyshare-schedule-images"],
  ["PREVIEW_D1_NAME", "skyshare-schedule-preview"],
  ["PREVIEW_D1_DATABASE_ID", null],
  ["PREVIEW_R2_BUCKET", "skyshare-schedule-images-preview"],
]
const UUID = /^[0-9a-f-]{36}$/
const HOST = /^[a-z0-9.-]+$/

// _legacy/frontend のビルド時変数（.env.production）
const LEGACY_VARS = [
  "PUBLIC_LEGACY_BACKEND_ENDPOINT",
  "PUBLIC_OGP_EXTRACTOR_API",
]

/**
 * 必須の環境変数を取得する。未設定・空文字・改行/引用符を含む値は異常終了とする。
 *
 * Input:
 * - `name`: 環境変数名
 *
 * Output:
 * - 環境変数の値（前後の空白は除去）
 *
 * 例:
 * - 入力: "PUBLIC_NODE_ENV" → 出力: "production"
 */
const requireEnv = name => {
  const value = (process.env[name] ?? "").trim()
  if (value === "") {
    console.error(
      `環境変数 ${name} が未設定です（GitHub の Variables に登録してください）`,
    )
    process.exit(1)
  }
  // JSON/.env へ値を埋め込むため、構文を壊す文字は拒否する
  if (/["\\\r\n]/.test(value)) {
    console.error(
      `環境変数 ${name} に使用できない文字（" \\ 改行）が含まれています`,
    )
    process.exit(1)
  }
  return value
}

// テンプレート内の `"KEY": "値"` を置換する。キーが見つからない場合はテンプレート変更の検知のため異常終了する
let wrangler = readFileSync("wrangler.template.jsonc", "utf8")
for (const name of WRANGLER_VARS) {
  const pattern = new RegExp(`("${name}"\\s*:\\s*)"[^"]*"`, "g")
  if (!pattern.test(wrangler)) {
    console.error(`wrangler.template.jsonc に ${name} が見つかりません`)
    process.exit(1)
  }
  const value = requireEnv(name)
  wrangler = wrangler.replace(pattern, (_match, head) => `${head}"${value}"`)
}
// 配備先の値を決める。`--staging` では、本番とは別の Worker・ドメインに、プレビューと同じ D1・R2 を使う
// （Cron Trigger は Worker 単位でしか動かず、`wrangler preview` では動かないため、
// 予約の自動投稿を確認する用の独立した Worker として配備する。本番のデータには触れない）
const deploy = Object.fromEntries(
  DEPLOY_VARS.map(([name, fallback]) => [
    name,
    fallback === null
      ? requireEnv(name)
      : (process.env[name] ?? "").trim() || fallback,
  ]),
)
for (const name of ["SCHEDULE_D1_DATABASE_ID", "PREVIEW_D1_DATABASE_ID"]) {
  if (!UUID.test(deploy[name])) {
    console.error(`${name} が UUID 形式ではありません`)
    process.exit(1)
  }
}
const staging = process.argv.includes("--staging")
if (staging) {
  deploy.WORKER_NAME = `${deploy.WORKER_NAME}-staging`
  deploy.SITE_HOST = requireEnv("STAGING_HOST")
  deploy.SCHEDULE_D1_NAME = deploy.PREVIEW_D1_NAME
  deploy.SCHEDULE_D1_DATABASE_ID = deploy.PREVIEW_D1_DATABASE_ID
  deploy.SCHEDULE_R2_BUCKET = deploy.PREVIEW_R2_BUCKET
}
for (const name of ["SITE_HOST", "ZONE_NAME"]) {
  if (!HOST.test(deploy[name])) {
    console.error(
      `${name} はドメイン名だけを指定してください（例: example.com）`,
    )
    process.exit(1)
  }
}
// テンプレートの `"WORKER_NAME"` のような値を置き換える。見つからない場合はテンプレート変更の検知のため異常終了する
for (const [name, value] of Object.entries(deploy)) {
  const token = `"${name}"`
  if (!wrangler.includes(token)) {
    console.error(`wrangler.template.jsonc に ${token} が見つかりません`)
    process.exit(1)
  }
  wrangler = wrangler.replaceAll(token, () => `"${value}"`)
}
// ステージングの Worker ではブランチ別のプレビューを作らない
if (staging) {
  wrangler = wrangler.replace(
    '"previews_enabled": true',
    '"previews_enabled": false',
  )
}
writeFileSync("wrangler.jsonc", wrangler)

// 独自ドメインの有効状況に合わせて workers_dev / preview_urls を設定する
execFileSync(
  "node",
  [
    ".claude/skills/branch-release-workflow/scripts/brw.mjs",
    "wrangler-config",
    "wrangler.jsonc",
    "--write",
  ],
  { stdio: "inherit" },
)

const legacyEnv = LEGACY_VARS.map(name => `${name}="${requireEnv(name)}"`).join(
  "\n",
)
writeFileSync("_legacy/frontend/.env.production", `${legacyEnv}\n`)

console.log("wrangler.jsonc と _legacy/frontend/.env.production を生成しました")
