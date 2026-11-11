/** GitHub Actions の環境変数から配備用設定を生成する。
 * 必須値が欠けると設定漏れの配備を防ぐため異常終了する。
 * 使い方: BRW_PLUGIN_DIR=<branch-release-workflow の clone> node scripts/config/render-deploy-config.mjs [--develop]
 * 必要な環境変数: docs/DEVELOP.md の「CI/CD（GitHub Actions）」を参照。
 */
import { execFileSync } from "node:child_process"
import { existsSync, writeFileSync } from "node:fs"
import { join, resolve } from "node:path"
import { RenderError, renderWranglerFile } from "./render-wrangler.mjs"

// 配備の設定に反映する環境変数（config/production.json の vars）
const CONFIG_VARS = [
  "PUBLIC_LEGACY_BACKEND_ENDPOINT",
  "PUBLIC_DEFAULT_ATP_SERVICE",
  "PUBLIC_NODE_ENV",
  "PUBLIC_OGP_EXTRACTOR_API",
  "PUBLIC_PLC_DIRECTORY_BASE_URL",
]
// 任意の運用者の設定（未設定なら config/production.json に入れない）
const OPTIONAL_CONFIG_VARS = [
  "PUBLIC_OPERATOR_NAME",
  "PUBLIC_OPERATOR_EMAIL",
  "PUBLIC_OPERATOR_BLUESKY_HANDLE",
  "PUBLIC_PRIVACY_ENACTED_AT",
  "PUBLIC_PRIVACY_REVISED_AT",
  "PUBLIC_GA_MEASUREMENT_ID",
]

// _legacy/frontend のビルド時変数（.env.production）
const LEGACY_VARS = [
  "PUBLIC_LEGACY_BACKEND_ENDPOINT",
  "PUBLIC_OGP_EXTRACTOR_API",
]

/**
 * branch-release-workflow プラグインの所在（clone したディレクトリ）を環境変数 BRW_PLUGIN_DIR から得る。
 *
 * 処理の趣旨:
 * - プラグインはリポジトリに同梱しないため、CI では clone した場所を渡す（.github/workflows の各 workflow）
 * - 未設定や brw.mjs が見つからない場合は、wrangler-config を省いた誤った設定で配備しないよう異常終了する
 *
 * Output: プラグインのルートの絶対パス
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

/**
 * 必須の環境変数を取得する。未設定・空文字・改行/引用符を含む値は異常終了とする。
 *
 * Input: `name`（環境変数名）
 * Output: 値（前後の空白は除去）
 */
const requireEnv = name => {
  const value = (process.env[name] ?? "").trim()
  if (value === "") {
    console.error(
      `環境変数 ${name} が未設定です（GitHub の Variables に登録してください）`,
    )
    process.exit(1)
  }
  // JSON と .env へ値を埋め込むため、構文を壊す文字は拒否する
  if (/["\\\r\n]/.test(value)) {
    console.error(
      `環境変数 ${name} に使用できない文字（" \\ 改行）が含まれています`,
    )
    process.exit(1)
  }
  return value
}

const brwPluginDir = resolveBrwPluginDir()

// 公開するドメインの形式（スキームやパスを含めない）は render-wrangler.mjs が検査する
const siteHost = requireEnv("SITE_HOST")
const vars = Object.fromEntries(
  CONFIG_VARS.map(name => [name, requireEnv(name)]),
)
for (const name of OPTIONAL_CONFIG_VARS) {
  const value = (process.env[name] ?? "").trim()
  if (value !== "") {
    if (/["\\\r\n]/.test(value)) {
      console.error(
        `環境変数 ${name} に使用できない文字（" \\ 改行）が含まれています`,
      )
      process.exit(1)
    }
    vars[name] = value
  }
}

// 配備の設定（config/production.json）を作る。配備の種類（--develop）は render-wrangler が決める
writeFileSync(
  "config/production.json",
  `${JSON.stringify({ siteHost, vars }, null, 2)}\n`,
)
const develop = process.argv.includes("--develop")
try {
  renderWranglerFile({ name: "production", develop })
  console.log(
    `wrangler.jsonc を config/production.json から生成しました${develop ? "（develop 用）" : ""}`,
  )
} catch (err) {
  if (!(err instanceof RenderError)) throw err
  console.error(err.message)
  process.exit(1)
}

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

const legacyEnv = LEGACY_VARS.map(name => `${name}="${vars[name]}"`).join("\n")
writeFileSync("_legacy/frontend/.env.production", `${legacyEnv}\n`)

console.log(
  "config/production.json・wrangler.jsonc・_legacy/frontend/.env.production を生成しました",
)
