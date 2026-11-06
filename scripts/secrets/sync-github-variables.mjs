// config/production.json と .dev.vars の値を、GitHub の Variables・Secrets（と --worker で Worker のシークレット）へ登録するスクリプト。
//
// 責務:
// - 登録の元は2つだけ。公開してよい値は config/production.json（siteHost → 変数 SITE_HOST、vars → 同名の変数）、
//   秘匿情報は .dev.vars（.gitignore 対象）。CI（deploy.yaml）は GitHub の Variables・Secrets を読んで配備する。
// - 運用者（config/production.json がある人）だけが動く。GitHub の書き込み権限（admin）が無い人は、エラーで止めずに登録をスキップする。
//   worktree など config/production.json が無い場所では、何もせず成功する（--if-configured）。
// - gh variable list で登録済みの値を読み、違う値だけを gh variable set で登録する（同じ値には触らない）。
// - Secrets は値を比べられないため、.dev.vars に値がある名前を毎回登録する。空の値は登録しない（登録済みの値を消さないため）。
// - Worker のシークレット（FEEDBACK_GITHUB_TOKEN）は --worker のときだけ、本番・develop・プレビューの Worker へ登録する。
// - 値は標準入力（または環境変数）で渡し、引数やプロセスの一覧に載せない。画面には名前と結果だけを出し、値は出さない。
// - 削除はしない。config に無い変数は警告だけする。SURVEY_CONFIG は `npm run survey` が管理するため対象外。
// - 例示ドメイン（example.com など）の値は、例の設定を本番へ誤って登録しないよう拒否する。
//
// 使い方: npm run sync:github [-- --dry-run] [-- --if-configured] [-- --worker] [-- --repo <owner/repo>]
//   --dry-run        登録せず、登録する名前だけを表示する
//   --if-configured  config/production.json が無いときは何もせず成功する（push の hook が使う）
//   --worker         Worker のシークレットも登録する（本番・develop・プレビュー）
//   --repo           GitHub のリポジトリ（既定: git remote の origin から判定する）
import { spawnSync } from "node:child_process"
import { existsSync, readFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"
import { repositoryFromRemote } from "../lib/github.mjs"
import { parseDotenv } from "../lib/dotenv.mjs"
import { workerNameFrom } from "../lib/wrangler.mjs"
import { RenderError, readConfig } from "../config/render-wrangler.mjs"

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..")
const CONFIG_NAME = "production"

/** この仕組みで登録・警告の対象にしない変数（別のコマンドが管理する） */
export const MANAGED_ELSEWHERE = ["SURVEY_CONFIG"]
/** .dev.vars から GitHub の Secrets へ登録する名前（CI が使う） */
export const GITHUB_SECRET_NAMES = [
  "CLOUDFLARE_API_TOKEN",
  "CLOUDFLARE_ACCOUNT_ID",
]
/** .dev.vars から Worker のシークレットへ登録する名前（--worker のときだけ） */
export const WORKER_SECRET_NAMES = ["FEEDBACK_GITHUB_TOKEN"]

// JSON と .env へ値を埋め込むため、構文を壊す文字は拒否する（render-deploy-config.mjs と同じ）
const UNSAFE_VALUE = /["\\\r\n]/
// RFC 2606 の例示ドメインは実在する Cloudflare のゾーンにならないため、公開するドメインとして拒否する
const RESERVED_HOST = /(^|\.)example\.(com|org|net)$/

/**
 * config の値から、GitHub に登録する変数（名前 → 値）を作る。空の値は登録しない。
 *
 * Input: `config`（readConfig の結果 `{ siteHost, vars }`）
 * Output: `{ SITE_HOST: 公開するドメイン, 変数名: 値, ... }`
 *
 * 例: `{ siteHost: "a.jp", vars: { PUBLIC_GA_MEASUREMENT_ID: "" } }` → `{ SITE_HOST: "a.jp" }`
 */
export const variablesFromConfig = config => {
  const desired = { SITE_HOST: config.siteHost }
  for (const [name, value] of Object.entries(config.vars)) {
    if (value.trim() !== "") desired[name] = value
  }
  return desired
}

/**
 * 登録できない値の変数名を集める。値そのものは返さない（画面やログに出さないため）。
 *
 * Input: `desired`（variablesFromConfig の結果）
 * Output: 問題のある変数名の配列（問題がなければ空）
 */
export const invalidVariables = desired =>
  Object.entries(desired)
    .filter(
      ([name, value]) =>
        UNSAFE_VALUE.test(value) ||
        (name === "SITE_HOST" && RESERVED_HOST.test(value)),
    )
    .map(([name]) => name)

/**
 * 登録する変更を決める。値は比べるだけで、表示しない。
 *
 * Input:
 * - `desired`: variablesFromConfig の結果
 * - `current`: GitHub に登録済みの変数（名前 → 値）
 *
 * Output:
 * - `{ update, unchanged, unmanaged }`（それぞれ変数名の配列）
 *   - update: 無い、または値が違う変数（登録する）
 *   - unchanged: 同じ値の変数（触らない）
 *   - unmanaged: GitHub にあるが config に無い変数（警告だけする。削除はしない）
 *
 * 例: desired `{ A: "1", B: "2" }`、current `{ A: "1", C: "3" }` →
 *   `{ update: ["B"], unchanged: ["A"], unmanaged: ["C"] }`
 */
export const planVariables = (desired, current) => {
  const update = []
  const unchanged = []
  for (const [name, value] of Object.entries(desired)) {
    if (current[name] === value) unchanged.push(name)
    else update.push(name)
  }
  const unmanaged = Object.keys(current).filter(
    name => !(name in desired) && !MANAGED_ELSEWHERE.includes(name),
  )
  return { update, unchanged, unmanaged }
}

/**
 * .dev.vars から、値のある名前だけを取り出す（空の値は登録しないため）。
 *
 * Input: `devVars`（parseDotenv の結果）、`names`（取り出す名前の配列）
 * Output: `{ 名前: 値 }`
 *
 * 例: `{ A: "x", B: "" }`・名前 ["A", "B", "C"] → `{ A: "x" }`
 */
export const pickSecrets = (devVars, names) =>
  Object.fromEntries(
    names
      .filter(name => (devVars[name] ?? "") !== "")
      .map(name => [name, devVars[name]]),
  )

/**
 * Worker のシークレットを登録する wrangler のコマンドを、本番・develop・プレビューの3つ作る。
 *
 * Input:
 * - `name`: シークレットの名前
 * - `workerName`: 本番の Worker の名前（develop は末尾に -develop を付ける）
 *
 * Output: `{ label, args }` の配列（args は npx の引数）
 *
 * 例: "X", "skyshare" → 本番 `["wrangler","secret","put","X","--name","skyshare"]` など
 */
export const workerSecretTargets = (name, workerName) => {
  const develop = `${workerName}-develop`
  return [
    {
      label: `Worker ${workerName}`,
      args: ["wrangler", "secret", "put", name, "--name", workerName],
    },
    {
      label: `Worker ${develop}`,
      args: ["wrangler", "secret", "put", name, "--name", develop],
    },
    {
      label: `プレビュー（${develop}）`,
      args: [
        "wrangler",
        "preview",
        "base-config",
        "secret",
        "put",
        name,
        "--worker-name",
        develop,
      ],
    },
  ]
}

/**
 * `gh api repos/<repo> --jq .permissions.admin` の出力から、書き込み（admin）の権限があるかを読む。
 *
 * Input: `output`（gh の標準出力）
 * Output: admin なら true
 */
export const isAdminOutput = output => output.trim() === "true"

/** `--key value` 形式の引数を読む */
const argValue = (args, key) => {
  const index = args.indexOf(key)
  return index >= 0 ? args[index + 1] : undefined
}

/** gh で登録済みの Variables を読む。失敗したら null */
const listVariables = repo => {
  const result = spawnSync(
    "gh",
    ["variable", "list", "-R", repo, "--json", "name,value"],
    { encoding: "utf8" },
  )
  if (result.status !== 0) return null
  return Object.fromEntries(
    JSON.parse(result.stdout).map(item => [item.name, item.value]),
  )
}

/** GitHub の書き込み権限（admin）があるか。判定できないときは例外（エラーで止める） */
const hasAdminAccess = repo => {
  const result = spawnSync(
    "gh",
    ["api", `repos/${repo}`, "--jq", ".permissions.admin"],
    { encoding: "utf8" },
  )
  if (result.status !== 0) {
    throw new Error(
      "GitHub のリポジトリの権限を読めませんでした（gh auth status で認証を確認する）",
    )
  }
  return isAdminOutput(result.stdout)
}

/** .dev.vars を読む。無ければ空 */
const readDevVars = () => {
  const file = path.join(ROOT, ".dev.vars")
  return existsSync(file) ? parseDotenv(readFileSync(file, "utf8")) : {}
}

/** 本番の Worker の名前を config/wrangler.template.jsonc の先頭の "name" から読む */
const readWorkerName = () =>
  workerNameFrom(
    readFileSync(path.join(ROOT, "config", "wrangler.template.jsonc"), "utf8"),
  )

/**
 * wrangler の認証に使う環境変数。シェルの値を優先し、無ければ .dev.vars の値を渡す（ファイルには書き戻さない）。
 */
const cloudflareEnv = devVars => {
  const env = { ...process.env }
  for (const name of ["CLOUDFLARE_API_TOKEN", "CLOUDFLARE_ACCOUNT_ID"]) {
    if (!env[name] && devVars[name]) env[name] = devVars[name]
  }
  return env
}

/** 値を標準入力で渡す登録。結果を表示し、失敗数を返す */
const setWithStdin = ({ label, name, command, args, value, dryRun, env }) => {
  if (dryRun) {
    console.log(`[dry-run] 登録する（${label}）: ${name}`)
    return 0
  }
  const result = spawnSync(command, args, {
    input: value,
    encoding: "utf8",
    env,
  })
  if (result.status === 0) {
    console.log(`登録しました（${label}）: ${name}`)
    return 0
  }
  console.error(`失敗しました（${label}）: ${name}`)
  console.error(`${result.stderr ?? ""}`.trim())
  return 1
}

const syncVariables = (repo, dryRun) => {
  const config = readConfig(CONFIG_NAME, { requireSiteHost: true })
  const desired = variablesFromConfig(config)
  const invalid = invalidVariables(desired)
  if (invalid.length > 0) {
    console.error(
      `登録できない値があります（値は表示しない）: ${invalid.join(", ")}`,
    )
    return 1
  }
  const current = listVariables(repo)
  if (!current) {
    console.error(
      "GitHub の Variables を読めませんでした（gh auth status で認証を確認する）",
    )
    return 1
  }
  const plan = planVariables(desired, current)
  console.log(
    `GitHub Variables（${repo}）: 変更なし ${plan.unchanged.length}件・登録 ${plan.update.length}件`,
  )
  for (const name of plan.unmanaged) {
    console.warn(
      `GitHub にだけある変数（削除はしません。不要なら手で消す）: ${name}`,
    )
  }
  let failed = 0
  for (const name of plan.update) {
    failed += setWithStdin({
      label: "Variables",
      name,
      command: "gh",
      args: ["variable", "set", name, "-R", repo],
      value: desired[name],
      dryRun,
    })
  }
  return failed
}

const syncGithubSecrets = (repo, devVars, dryRun) => {
  const secrets = pickSecrets(devVars, GITHUB_SECRET_NAMES)
  let failed = 0
  for (const name of GITHUB_SECRET_NAMES) {
    if (!(name in secrets)) {
      console.log(`.dev.vars に値が無いため登録しません（Secrets）: ${name}`)
      continue
    }
    failed += setWithStdin({
      label: "Secrets",
      name,
      command: "gh",
      args: ["secret", "set", name, "-R", repo],
      value: secrets[name],
      dryRun,
    })
  }
  return failed
}

const syncWorkerSecrets = (devVars, dryRun) => {
  const secrets = pickSecrets(devVars, WORKER_SECRET_NAMES)
  const workerName = readWorkerName()
  const env = cloudflareEnv(devVars)
  let failed = 0
  for (const name of WORKER_SECRET_NAMES) {
    if (!(name in secrets)) {
      console.log(`.dev.vars に値が無いため Worker へ登録しません: ${name}`)
      continue
    }
    for (const target of workerSecretTargets(name, workerName)) {
      failed += setWithStdin({
        label: target.label,
        name,
        command: "npx",
        args: target.args,
        value: secrets[name],
        dryRun,
        env,
      })
    }
  }
  return failed
}

const main = () => {
  const args = process.argv.slice(2)
  const dryRun = args.includes("--dry-run")
  const configPath = path.join(ROOT, "config", `${CONFIG_NAME}.json`)
  if (!existsSync(configPath)) {
    if (args.includes("--if-configured")) {
      console.log("config/production.json がないため、登録は行いません")
      return
    }
    readConfig(CONFIG_NAME, { requireSiteHost: true })
  }

  const remote = spawnSync("git", ["remote", "get-url", "origin"], {
    cwd: ROOT,
    encoding: "utf8",
  })
  const repo =
    argValue(args, "--repo") ?? repositoryFromRemote(remote.stdout ?? "")
  if (!repo) {
    console.error(
      "GitHub のリポジトリを判定できません（--repo owner/repo で指定する）",
    )
    process.exit(1)
  }

  const devVars = readDevVars()
  let admin
  try {
    admin = hasAdminAccess(repo)
  } catch (err) {
    console.error(err.message)
    process.exit(1)
  }
  let failed = 0
  if (admin) {
    failed += syncVariables(repo, dryRun)
    failed += syncGithubSecrets(repo, devVars, dryRun)
  } else {
    // 書き込み権限の無い人（コントリビュータ）は、エラーにせずスキップする
    console.warn(
      `GitHub の書き込み権限が無いため（運用者だけが実行する）、Variables と Secrets は登録しません（${repo}）`,
    )
  }
  if (args.includes("--worker")) {
    failed += syncWorkerSecrets(devVars, dryRun)
  }
  if (failed > 0) process.exit(1)
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  try {
    main()
  } catch (err) {
    // 設定の不足は表示して終了する（スタックトレースは出さない）
    if (!(err instanceof RenderError)) throw err
    console.error(err.message)
    process.exit(1)
  }
}
