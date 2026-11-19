/** branch-release-workflow（BRW）の renderHook。BRW が生成した wrangler 設定に、GitHub Actions の環境変数から skyshare 固有の設定を加える。
 * BRW の `render-wrangler --target <配備先> --write` が、Worker 名・独自ドメイン・workers_dev / preview_urls・previews を宣言
 * （.branch-release-workflow.json の deploy）どおりに書いた後で呼ぶ。ここでは vars、develop 用の D1・R2 の名前と ID、
 * _legacy/frontend/.env.production を扱う。必須値が欠けると設定漏れの配備を防ぐため異常終了する。
 * 使い方: BRW が環境変数 BRW_TARGET（production / develop）と BRW_OUTPUT（生成先の絶対パス）を渡して呼ぶ。
 * 必要な環境変数: docs/DEVELOP.md の「CI/CD（GitHub Actions）」を参照。
 */
import { readFileSync, writeFileSync } from "node:fs"
import { parseJsonc } from "../lib/jsonc.mjs"
import {
  applyRuntimeConfig,
  hasReadCredentials,
  readConfig,
  readTemplate,
  RenderError,
  resolveD1Ids,
} from "./render-wrangler.mjs"

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
  "PUBLIC_PRIVACY_REVISED_AT",
  "PUBLIC_GA_MEASUREMENT_ID",
]

// _legacy/frontend のビルド時変数（.env.production）
const LEGACY_VARS = [
  "PUBLIC_LEGACY_BACKEND_ENDPOINT",
  "PUBLIC_OGP_EXTRACTOR_API",
]

// BRW の宣言（deploy.targets）の配備先の名前
const TARGETS = ["production", "develop"]

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

const target = process.env.BRW_TARGET ?? ""
const output = process.env.BRW_OUTPUT ?? ""
if (!TARGETS.includes(target) || output === "") {
  console.error(
    "branch-release-workflow の render-wrangler から呼んでください（BRW_TARGET は production / develop、BRW_OUTPUT は生成先）",
  )
  process.exit(1)
}

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

// 配備の設定（config/production.json）を作る。develop の配備も同じ値を使い、違いは BRW の宣言と applyRuntimeConfig が決める
writeFileSync(
  "config/production.json",
  `${JSON.stringify({ siteHost, vars }, null, 2)}\n`,
)
const develop = target === "develop"
try {
  const template = readTemplate()
  const out = applyRuntimeConfig(parseJsonc(readFileSync(output, "utf8")), {
    template,
    config: readConfig("production", { requireSiteHost: true }),
    develop,
    d1Ids: develop ? resolveD1Ids(template) : {},
    remote: hasReadCredentials(process.env),
  })
  writeFileSync(output, `${JSON.stringify(out, null, 2)}\n`)
  console.log(
    `${output} に config/production.json の設定を加えました（配備先: ${target}）`,
  )
} catch (err) {
  if (!(err instanceof RenderError)) throw err
  console.error(err.message)
  process.exit(1)
}

const legacyEnv = LEGACY_VARS.map(name => `${name}="${vars[name]}"`).join("\n")
writeFileSync("_legacy/frontend/.env.production", `${legacyEnv}\n`)

console.log(
  "config/production.json・wrangler.jsonc・_legacy/frontend/.env.production を生成しました",
)
