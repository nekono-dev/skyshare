// CI/CD(GitHub Actions)用に、デプロイ設定ファイルを環境変数から生成するスクリプト。
//
// 責務:
// - wrangler.template.jsonc の vars を環境変数の値で置き換え、wrangler.jsonc を生成する
//   （wrangler.jsonc は本番値を含むため .gitignore 対象。CIでは都度生成する）
// - _legacy/frontend/.env.production を生成する（こちらも .gitignore 対象）
//
// 使い方: node hack/render-deploy-config.mjs
// 必須の環境変数が1つでも未設定/空の場合は、設定漏れによる誤デプロイを防ぐため異常終了する。
import { readFileSync, writeFileSync } from "node:fs"

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
  const pattern = new RegExp(`("${name}"\\s*:\\s*)"[^"]*"`)
  if (!pattern.test(wrangler)) {
    console.error(`wrangler.template.jsonc に ${name} が見つかりません`)
    process.exit(1)
  }
  const value = requireEnv(name)
  wrangler = wrangler.replace(pattern, (_match, head) => `${head}"${value}"`)
}
writeFileSync("wrangler.jsonc", wrangler)

const legacyEnv = LEGACY_VARS.map(name => `${name}="${requireEnv(name)}"`).join(
  "\n",
)
writeFileSync("_legacy/frontend/.env.production", `${legacyEnv}\n`)

console.log("wrangler.jsonc と _legacy/frontend/.env.production を生成しました")
