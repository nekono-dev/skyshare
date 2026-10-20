// CI/CD(GitHub Actions)用に、デプロイ設定ファイルを環境変数から生成するスクリプト。
//
// 責務:
// - wrangler.template.jsonc の vars を環境変数の値で置き換え、wrangler.jsonc を生成する
//   （wrangler.jsonc は本番値を含むため .gitignore 対象。CIでは都度生成する）
// - 生成した wrangler.jsonc の workers_dev / preview_urls を、独自ドメインの有効状況に合わせて設定する
//   （branch-release-workflow スキルの wrangler-config。省略しない）
// - _legacy/frontend/.env.production を生成する（こちらも .gitignore 対象）
//
// 使い方: node hack/render-deploy-config.mjs [--staging]
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

const PROD_D1_ID = "60ca03d7-b17a-480d-bf74-50013ed7855b"
// ステージング用（プレビューと同じ専用の D1・R2 を使う）
const STAGING_HOST = "prev-skyshare.nekono.dev"
const STAGING_D1_NAME = "skyshare-schedule-preview"
const STAGING_D1_ID = "ee858bd4-d6d5-4be4-87d9-7e36e630e096"
const STAGING_R2_NAME = "skyshare-schedule-images-preview"

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
// 予約投稿用 D1 の database_id。秘密情報ではないため、未設定のときは本番用の既定値を使う
// （別のデータベースへ向けたいときだけ Variable `SCHEDULE_D1_DATABASE_ID` で上書きする）
const scheduleD1Id = (process.env.SCHEDULE_D1_DATABASE_ID ?? "").trim()
if (scheduleD1Id !== "" && !/^[0-9a-f-]{36}$/.test(scheduleD1Id)) {
  console.error("SCHEDULE_D1_DATABASE_ID が UUID 形式ではありません")
  process.exit(1)
}
wrangler = wrangler.replace(
  "SCHEDULE_D1_DATABASE_ID",
  scheduleD1Id || PROD_D1_ID,
)
// ステージング（`--staging`）: 本番とは別の Worker・ドメイン・D1・R2 に向ける。
// Cron Trigger は Worker 単位でしか動かず、`wrangler preview` では動かないため、
// 予約の自動投稿を確認する用の独立した Worker として配備する（本番のデータには触れない）
if (process.argv.includes("--staging")) {
  const replaceFirst = (from, to) => {
    if (!wrangler.includes(from)) {
      console.error(`wrangler.template.jsonc に ${from} が見つかりません`)
      process.exit(1)
    }
    // 先頭側（本番用の最上位の設定）だけを置き換える。previews ブロックは後ろにある
    wrangler = wrangler.replace(from, () => to)
  }
  replaceFirst('"name": "skyshare"', '"name": "skyshare-staging"')
  replaceFirst(
    '"pattern": "skyshare.nekono.dev"',
    `"pattern": "${STAGING_HOST}"`,
  )
  replaceFirst('"previews_enabled": true', '"previews_enabled": false')
  replaceFirst(
    '"database_name": "skyshare-schedule"',
    `"database_name": "${STAGING_D1_NAME}"`,
  )
  replaceFirst(
    `"database_id": "${scheduleD1Id || PROD_D1_ID}"`,
    `"database_id": "${STAGING_D1_ID}"`,
  )
  replaceFirst(
    '"bucket_name": "skyshare-schedule-images"',
    `"bucket_name": "${STAGING_R2_NAME}"`,
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
