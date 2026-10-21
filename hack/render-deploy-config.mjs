// CI/CD(GitHub Actions)用に、デプロイ設定ファイルを環境変数から生成するスクリプト。
//
// 責務:
// - wrangler.template.jsonc の vars と公開するドメインを環境変数の値で置き換え、wrangler.jsonc を生成する
//   （wrangler.jsonc は本番値を含むため .gitignore 対象。CIでは都度生成する）
// - 生成した wrangler.jsonc の workers_dev / preview_urls を、独自ドメインの有効状況に合わせて設定する
//   （branch-release-workflow スキルの wrangler-config。省略しない）
// - _legacy/frontend/.env.production を生成する（こちらも .gitignore 対象）
//
// 使い方: node hack/render-deploy-config.mjs [--develop]
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

// 公開するドメインの形式（スキームやパスを含めない）
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
// 配備先を決める。既定は本番（main）。`--develop` では develop 用の別の Worker にする。
// develop の Worker は Cron が動く確認用の環境で、dev/* のプレビューもこの Worker の独自ドメイン配下に作る。
// D1・R2 は develop 専用（本番の予約に触れない）。名前は固定で、運用者ごとの値は SITE_HOST だけ
const develop = process.argv.includes("--develop")
const siteHost = requireEnv("SITE_HOST")
if (!HOST.test(siteHost)) {
  console.error(
    "SITE_HOST はドメイン名だけを指定してください（例: skyshare.example.com）",
  )
  process.exit(1)
}
// テンプレートの値を置き換える。見つからない場合はテンプレート変更の検知のため異常終了する
const replaceOnce = (from, to) => {
  if (!wrangler.includes(from)) {
    console.error(`wrangler.template.jsonc に ${from} が見つかりません`)
    process.exit(1)
  }
  wrangler = wrangler.replace(from, () => to)
}
if (develop) {
  const d1Name = "skyshare-schedule-develop"
  const r2Name = "skyshare-schedule-images-develop"
  replaceOnce('"name": "skyshare"', '"name": "skyshare-develop"')
  replaceOnce('"pattern": "SITE_HOST"', `"pattern": "develop.${siteHost}"`)
  // dev/* のプレビュー（<名前>.develop.<SITE_HOST>）を、この Worker の独自ドメインで配信する
  replaceOnce('"previews_enabled": false', '"previews_enabled": true')
  replaceOnce(
    '"database_name": "skyshare-schedule"',
    `"database_name": "${d1Name}"`,
  )
  replaceOnce(
    '"bucket_name": "skyshare-schedule-images"',
    `"bucket_name": "${r2Name}"`,
  )
  // プレビューは database_id のない D1 を使えないため、名前から引いた ID を previews に入れる
  // （ID は運用者ごとに違うのでリポジトリに書かない。CI の API トークンに D1 の権限が要る）
  // `wrangler d1 info <名前>` は設定ファイルに無い D1 を名前で引けないため、一覧から名前で探す
  const list = JSON.parse(
    execFileSync("npx", ["wrangler", "d1", "list", "--json"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "inherit"],
    }),
  )
  const uuid = list.find(db => db.name === d1Name)?.uuid ?? ""
  if (!/^[0-9a-f-]{36}$/.test(uuid)) {
    console.error(
      `D1 ${d1Name} が見つかりません（先に wrangler d1 create で作成する）`,
    )
    process.exit(1)
  }
  replaceOnce(
    '  "previews": {\n',
    `  "previews": {
    "d1_databases": [
      { "binding": "DB", "database_name": "${d1Name}", "database_id": "${uuid}" },
    ],
    "r2_buckets": [{ "binding": "SCHEDULE_IMAGES", "bucket_name": "${r2Name}" }],
`,
  )
} else {
  replaceOnce('"pattern": "SITE_HOST"', `"pattern": "${siteHost}"`)
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
