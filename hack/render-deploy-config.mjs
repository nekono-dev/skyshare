// CI/CD(GitHub Actions)用に、デプロイ設定ファイルを環境変数から生成するスクリプト。
//
// 責務:
// - wrangler.template.jsonc の vars と公開するドメインを環境変数の値で置き換え、wrangler.jsonc を生成する
// - `--develop` では develop 用の別の Worker（Cron が動く確認用の環境。dev/* のプレビューの親）の設定にする
//   （wrangler.jsonc は本番値を含むため .gitignore 対象。CIでは都度生成する）
// - 生成した wrangler.jsonc の workers_dev / preview_urls を、独自ドメインの有効状況に合わせて設定する
//   （branch-release-workflow プラグインの wrangler-config。省略しない）
// - _legacy/frontend/.env.production を生成する（こちらも .gitignore 対象）
//
// 使い方: BRW_PLUGIN_DIR=<branch-release-workflow の clone> node hack/render-deploy-config.mjs [--develop]
// 必要な環境変数は DEVELOP.md の「CI/CD（GitHub Actions）」を参照。
// branch-release-workflow はリポジトリに同梱しないプラグインのため、clone した場所を BRW_PLUGIN_DIR で渡す。
// 必須の環境変数が1つでも未設定/空の場合は、設定漏れによる誤デプロイを防ぐため異常終了する。
import { execFileSync } from "node:child_process"
import { existsSync, readFileSync, writeFileSync } from "node:fs"
import { join, resolve } from "node:path"
import { pathToFileURL } from "node:url"

/**
 * branch-release-workflow プラグインの所在（clone したディレクトリ）を環境変数 BRW_PLUGIN_DIR から得る。
 *
 * 処理の趣旨:
 * - プラグインはリポジトリに同梱しないため、CI では clone した場所を渡す（.github/workflows の各 workflow）
 * - 未設定や brw.mjs が見つからない場合は、wrangler-config を省いた誤った設定で配備しないよう異常終了する
 *
 * Input: なし（環境変数 BRW_PLUGIN_DIR）
 *
 * Output:
 * - プラグインのルートの絶対パス
 *
 * 例:
 * - 入力: BRW_PLUGIN_DIR=/tmp/brw
 * - 出力: "/tmp/brw"
 */
const resolveBrwPluginDir = () => {
  const dir = process.env.BRW_PLUGIN_DIR?.trim()
  if (!dir || !existsSync(join(dir, "scripts", "brw.mjs"))) {
    console.error(
      "環境変数 BRW_PLUGIN_DIR に branch-release-workflow の clone を指定してください" +
        "（例: git clone --depth 1 https://github.com/nekono-dev/branch-release-workflow.git /tmp/brw）",
    )
    process.exit(1)
  }
  return resolve(dir)
}
const brwPluginDir = resolveBrwPluginDir()
const { parseJsonc } = await import(
  pathToFileURL(
    join(brwPluginDir, "scripts", "providers", "cloudflare-previews.mjs"),
  ).href
)

// wrangler.jsonc の vars に反映する環境変数（Cloudflare Worker の実行時変数）
const WRANGLER_VARS = [
  "PUBLIC_LEGACY_BACKEND_ENDPOINT",
  "PUBLIC_DEFAULT_ATP_SERVICE",
  "PUBLIC_NODE_ENV",
  "PUBLIC_OGP_EXTRACTOR_API",
  "PUBLIC_PLC_DIRECTORY_BASE_URL",
]

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

// 公開するドメインの形式（スキームやパスを含めない）
const HOST = /^[a-z0-9.-]+$/
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
// 配備先を決める。既定は本番（main）。`--develop` では develop 用の別の Worker にし、
// テンプレートにある D1・R2 は名前の末尾に -develop を付けた develop 専用のものを使う（本番のデータに触れない）。
// 運用者ごとの値は SITE_HOST だけ（develop は develop.<SITE_HOST>、プレビューは <名前>.develop.<SITE_HOST>）
if (process.argv.includes("--develop")) {
  const template = parseJsonc(wrangler)
  const d1 = (template.d1_databases ?? []).map(db => ({
    binding: db.binding,
    database_name: `${db.database_name}-develop`,
  }))
  const r2 = (template.r2_buckets ?? []).map(b => ({
    binding: b.binding,
    bucket_name: `${b.bucket_name}-develop`,
  }))
  replaceOnce(
    `"name": "${template.name}"`,
    `"name": "${template.name}-develop"`,
  )
  replaceOnce('"pattern": "SITE_HOST"', `"pattern": "develop.${siteHost}"`)
  // dev/* のプレビューを、この Worker の独自ドメインの配下で配信する
  replaceOnce('"previews_enabled": false', '"previews_enabled": true')
  for (const db of template.d1_databases ?? []) {
    replaceOnce(
      `"database_name": "${db.database_name}"`,
      `"database_name": "${db.database_name}-develop"`,
    )
  }
  for (const b of template.r2_buckets ?? []) {
    replaceOnce(
      `"bucket_name": "${b.bucket_name}"`,
      `"bucket_name": "${b.bucket_name}-develop"`,
    )
  }
  // プレビューは database_id のない D1 を使えないため、D1 の一覧から名前で ID を引いて previews に入れる
  // （ID は運用者ごとに違うのでリポジトリに書かない。CI の API トークンに D1 の権限が要る）
  if (d1.length > 0) {
    const list = JSON.parse(
      execFileSync("npx", ["wrangler", "d1", "list", "--json"], {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "inherit"],
      }),
    )
    for (const db of d1) {
      db.database_id = list.find(x => x.name === db.database_name)?.uuid ?? ""
      if (!/^[0-9a-f-]{36}$/.test(db.database_id)) {
        console.error(
          `D1 ${db.database_name} が見つかりません（先に wrangler d1 create で作成する）`,
        )
        process.exit(1)
      }
    }
  }
  const previewBindings = [
    d1.length > 0 ? `    "d1_databases": ${JSON.stringify(d1)},\n` : "",
    r2.length > 0 ? `    "r2_buckets": ${JSON.stringify(r2)},\n` : "",
  ].join("")
  replaceOnce('  "previews": {\n', `  "previews": {\n${previewBindings}`)
} else {
  replaceOnce('"pattern": "SITE_HOST"', `"pattern": "${siteHost}"`)
}
writeFileSync("wrangler.jsonc", wrangler)

// 独自ドメインの有効状況に合わせて workers_dev / preview_urls を設定する
execFileSync(
  "node",
  [
    join(brwPluginDir, "scripts", "brw.mjs"),
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
