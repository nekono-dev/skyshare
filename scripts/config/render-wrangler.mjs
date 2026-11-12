/** 設定ファイルと Wrangler テンプレートから `wrangler.jsonc` を生成する。
 * 秘密情報は含めず、失敗は呼び出し元が扱える `RenderError` として返す。
 * 使い方: node scripts/config/render-wrangler.mjs <設定の名前> [--develop]
 */
import { execFileSync } from "node:child_process"
import { existsSync, readFileSync, writeFileSync } from "node:fs"
import { join, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { parseJsonc } from "../lib/jsonc.mjs"

const ROOT = resolve(fileURLToPath(new URL("../..", import.meta.url)))
const TEMPLATE = join(ROOT, "config", "wrangler.template.jsonc")
const OUTPUT = join(ROOT, "wrangler.jsonc")

// 公開するドメイン（スキームやパスを含めない）
const HOST = /^[a-z0-9.-]+$/
// 設定ファイルに必ず必要な vars（Worker の実行時にも使われる）
const REQUIRED_VARS = [
  "PUBLIC_LEGACY_BACKEND_ENDPOINT",
  "PUBLIC_DEFAULT_ATP_SERVICE",
  "PUBLIC_NODE_ENV",
  "PUBLIC_OGP_EXTRACTOR_API",
  "PUBLIC_PLC_DIRECTORY_BASE_URL",
]

/** 設定の不足・不正など、利用者が直せる失敗。CLI は表示して終了し、呼び出し元は扱いを決める */
export class RenderError extends Error {}

/**
 * 設定ファイル（config/<名前>.json）を読んで検査する。
 *
 * Input: `name`（config/ の名前）
 * Output: `{ siteHost?: string, vars: Record<string, string> }`
 * 失敗: RenderError（不足・不正な値の内容を含む）
 * 例: readConfig("develop") → { vars: { PUBLIC_NODE_ENV: "develop", ... } }
 */
export const readConfig = (name, { requireSiteHost = false } = {}) => {
  const path = join(ROOT, "config", `${name}.json`)
  if (!existsSync(path)) {
    throw new RenderError(
      `config/${name}.json がありません。config/${name}.example.json をコピーして作成してください（手順は docs/DEVELOP.md）`,
    )
  }
  const config = JSON.parse(readFileSync(path, "utf8"))
  const vars = config.vars ?? {}
  for (const [key, value] of Object.entries(vars)) {
    if (typeof value !== "string") {
      throw new RenderError(
        `config/${name}.json の ${key} は文字列で指定してください`,
      )
    }
  }
  for (const key of REQUIRED_VARS) {
    if (!(vars[key] ?? "").trim()) {
      throw new RenderError(`config/${name}.json に ${key} がありません`)
    }
  }
  if (requireSiteHost && !config.siteHost) {
    throw new RenderError(
      `config/${name}.json に siteHost（配備するドメイン）がありません`,
    )
  }
  if (config.siteHost !== undefined && !HOST.test(config.siteHost)) {
    throw new RenderError(
      "siteHost はドメイン名だけを指定してください（例: skyshare.example.com）",
    )
  }
  return { siteHost: config.siteHost, vars }
}

/**
 * テンプレートから wrangler の設定（オブジェクト）を組み立てる。
 *
 * Input: テンプレートの値、設定、`develop`（true なら develop 用の配備）、`d1Ids`（develop のプレビューに使う D1 の ID）、
 * `surveyResultsRemote`（true なら統計ファイルの R2 を、ビルドと dev が実際のバケットから読む）
 * Output: wrangler の設定（JSON にできるオブジェクト）
 */
export const buildWranglerConfig = ({
  template,
  config,
  develop,
  d1Ids = {},
  surveyResultsRemote = false,
}) => {
  const out = structuredClone(template)
  out.vars = { ...config.vars }
  out.previews = { ...out.previews, vars: { ...config.vars } }
  if (config.siteHost) {
    out.routes = [
      {
        ...out.routes[0],
        pattern: develop ? `develop.${config.siteHost}` : config.siteHost,
        // プレビューは検証版（develop）の独自ドメインだけで許可する。本番のドメインにはプレビューを出さない
        previews_enabled: develop,
      },
    ]
  } else {
    // 独自ドメインが無い（開発・E2E）場合は routes を付けない
    delete out.routes
  }
  if (develop) {
    out.name = `${template.name}-develop`
    out.d1_databases = template.d1_databases.map(db => ({
      ...db,
      database_name: `${db.database_name}-develop`,
    }))
    out.r2_buckets = template.r2_buckets.map(b => ({
      ...b,
      bucket_name: `${b.bucket_name}-develop`,
    }))
    // プレビューは database_id のない D1 を使えないため、名前から引いた ID を入れる
    out.previews.d1_databases = out.d1_databases.map(db => ({
      binding: db.binding,
      database_name: db.database_name,
      database_id: d1Ids[db.database_name],
    }))
    out.previews.r2_buckets = out.r2_buckets.map(b => ({
      binding: b.binding,
      bucket_name: b.bucket_name,
    }))
  }
  // 実際のバケットを読む接続は、認証情報があるときだけ有効にする（無いと dev と E2E が起動できない）
  if (surveyResultsRemote) {
    out.r2_buckets = out.r2_buckets.map(b =>
      b.binding === "SURVEY_RESULTS" ? { ...b, remote: true } : b,
    )
  }
  return out
}

/**
 * develop の配備で使う D1 の ID を、名前（`<database_name>-develop`）から引く。
 *
 * Input: テンプレートの値
 * Output: `{ "<名前>-develop": "<ID>" }`。D1 が無ければ空
 * 失敗: 名前が一覧に無いとき RenderError（先に wrangler d1 create が要る）
 */
export const resolveD1Ids = template => {
  const databases = template.d1_databases ?? []
  if (databases.length === 0) return {}
  // ID は運用者ごとに違うのでリポジトリに書かない。CI の API トークンに D1 の権限が要る
  const list = JSON.parse(
    execFileSync("npx", ["wrangler", "d1", "list", "--json"], {
      cwd: ROOT,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "inherit"],
    }),
  )
  const d1Ids = {}
  for (const db of databases) {
    const name = `${db.database_name}-develop`
    const id = list.find(x => x.name === name)?.uuid ?? ""
    if (!/^[0-9a-f-]{36}$/.test(id)) {
      throw new RenderError(
        `D1 ${name} が見つかりません（先に wrangler d1 create で作成する）`,
      )
    }
    d1Ids[name] = id
  }
  return d1Ids
}

/**
 * config/<名前>.json と config/wrangler.template.jsonc から wrangler.jsonc を書く。同じプロセスで呼べる入口。
 *
 * Input: `name`（config/ の名前）、`develop`（develop 用の配備にするか）
 * Output: 書いたファイルの絶対パス
 * 失敗: RenderError を投げる（process.exit は呼ばない）
 */
export const renderWranglerFile = ({ name, develop = false }) => {
  const config = readConfig(name, {
    requireSiteHost: develop || name === "production",
  })
  const template = parseJsonc(readFileSync(TEMPLATE, "utf8"))
  const d1Ids = develop ? resolveD1Ids(template) : {}
  // ビルドが R2 を読むための認証情報（CI が渡す）。無ければ接続せず、統計ファイルの機能は無い前提で動く
  const surveyResultsRemote = Boolean(
    process.env.CLOUDFLARE_API_TOKEN && process.env.CLOUDFLARE_ACCOUNT_ID,
  )
  const out = buildWranglerConfig({
    template,
    config,
    develop,
    d1Ids,
    surveyResultsRemote,
  })
  writeFileSync(OUTPUT, `${JSON.stringify(out, null, 2)}\n`)
  return OUTPUT
}

const main = () => {
  const args = process.argv.slice(2)
  const name = args.find(a => !a.startsWith("--"))
  if (!name) {
    console.error(
      "使い方: node scripts/config/render-wrangler.mjs <設定の名前> [--develop]",
    )
    process.exit(1)
  }
  const develop = args.includes("--develop")
  try {
    renderWranglerFile({ name, develop })
  } catch (err) {
    if (!(err instanceof RenderError)) throw err
    console.error(err.message)
    process.exit(1)
  }
  console.log(
    `wrangler.jsonc を config/${name}.json から生成しました${develop ? "（develop 用）" : ""}`,
  )
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main()
}
