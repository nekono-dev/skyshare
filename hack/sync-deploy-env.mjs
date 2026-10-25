// 配備に使う設定値（deploy.env）を、GitHub の Variables・Secrets と Worker のシークレットへまとめて登録するスクリプト。
//
// 責務:
// - deploy.env（deploy.env.template のコピー。.gitignore 対象）を区分（[...]）ごとに読み、登録先を決める
//   - [github.variables]           → gh variable set（Actions の Variables）
//   - [github.secrets]             → gh secret set（Actions の Secrets）
//   - [worker.secrets]             → 本番・develop・プレビューの Worker（wrangler secret put / preview base-config）
//   - [worker.secrets.production]  → 本番の Worker
//   - [worker.secrets.develop]     → develop の Worker とプレビュー（D1 を共用するため同じ値にする）
// - 値が空の行は登録しない（登録済みの値を消したり、予約投稿の鍵を意図せず替えたりしないため）
// - 値はコマンドの引数に載せず、標準入力で渡す（プロセスの一覧やシェルの履歴に残さないため）。画面にも出さない
//
// 使い方: npm run deploy:env [-- --dry-run] [-- --file <パス>] [-- --repo <owner/repo>]
//   --dry-run  登録先と変数名だけを表示し、登録しない
//   --file     読むファイル（既定: リポジトリ直下の deploy.env）
//   --repo     GitHub のリポジトリ（既定: git remote の origin から判定。SSH の別名のときも判定できる）
import { spawnSync } from "node:child_process"
import { existsSync, readFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")

/** 受け付ける区分。これ以外の区分はファイルの誤りとして扱う */
export const SECTIONS = [
  "github.variables",
  "github.secrets",
  "worker.secrets",
  "worker.secrets.production",
  "worker.secrets.develop",
]

/**
 * deploy.env を区分ごとの値に分ける。
 *
 * 想定する入力形状:
 * - `[区分]` の見出し行と、`KEY=value` の行。`#` で始まる行と空行は無視する
 * - 値は前後の空白を除き、両端の引用符（' か "）を外す
 *
 * Input:
 * - `content`: ファイルの中身
 *
 * Output:
 * - `{ 区分: { KEY: value } }`。区分の外の値・未知の区分・形式の違う行は例外を投げる
 *
 * 例:
 * - 入力: "[github.secrets]\nA='x'\n" → 出力: `{ "github.secrets": { A: "x" } }`
 */
export const parseDeployEnv = content => {
  const result = {}
  let section = null
  content.split(/\r?\n/).forEach((raw, index) => {
    const line = raw.trim()
    if (line === "" || line.startsWith("#")) return
    const header = /^\[([a-z.]+)\]$/.exec(line)
    if (header) {
      if (!SECTIONS.includes(header[1])) {
        throw new Error(`${index + 1}行目: 未知の区分 [${header[1]}]`)
      }
      section = header[1]
      result[section] ??= {}
      return
    }
    const pair = /^([A-Z][A-Z0-9_]*)\s*=(.*)$/.exec(line)
    if (!pair)
      throw new Error(`${index + 1}行目: KEY=value の形式ではありません`)
    if (!section)
      throw new Error(`${index + 1}行目: 区分（[...]）の前に値があります`)
    result[section][pair[1]] = pair[2].trim().replace(/^(['"])(.*)\1$/, "$2")
  })
  return result
}

/**
 * Git のリモートの URL から、GitHub のリポジトリの `owner/repo` を取り出す。
 *
 * Input:
 * - `remoteUrl`: `git remote get-url origin` の出力（`git@github.com.<別名>:o/r.git` の SSH の別名も許す）
 *
 * Output:
 * - `owner/repo`。判定できなければ null
 *
 * 例:
 * - 入力: "git@github.com.nekono:nekono-dev/skyshare.git" → 出力: "nekono-dev/skyshare"
 */
export const repositoryFromRemote = remoteUrl => {
  const match =
    /github\.com[^:/]*[:/]([A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+?)(?:\.git)?\/?$/.exec(
      remoteUrl.trim(),
    )
  return match ? match[1] : null
}

/**
 * 区分ごとの値から、実行する登録の一覧を組み立てる（値の読み込み以外の副作用なし）。
 *
 * 処理の趣旨:
 * - 空の値は登録しない。`@<パス>` の値は、`readFile` でファイルの中身に置き換える。
 * - Worker のシークレットは、区分に応じて本番・develop・プレビューの登録先に展開する。
 *
 * Input:
 * - `sections`: `parseDeployEnv` の結果
 * - `opts.repo`: GitHub のリポジトリ（`owner/repo`）
 * - `opts.worker`: 本番の Worker の名前（develop は末尾に -develop を付けた名前）
 * - `opts.readFile`: `@<パス>` を読む関数
 *
 * Output:
 * - `{ label, name, command, args, value }` の配列（`label` は表示用の登録先）
 *
 * 例:
 * - 入力: `{ "worker.secrets": { T: "v" } }` → 出力: 本番・develop・プレビューの3件
 */
export const planRegistrations = (sections, opts) => {
  const plans = []
  const develop = `${opts.worker}-develop`
  const resolve = value =>
    value.startsWith("@") ? opts.readFile(value.slice(1)) : value
  const each = (section, fn) => {
    for (const [name, raw] of Object.entries(sections[section] ?? {})) {
      if (raw === "") continue
      fn(name, resolve(raw))
    }
  }
  const gh = (kind, label) => (name, value) =>
    plans.push({
      label,
      name,
      value,
      command: "gh",
      args: [kind, "set", name, "-R", opts.repo],
    })
  const workerSecret = name => (secret, value) =>
    plans.push({
      label: `Worker ${name}`,
      name: secret,
      value,
      command: "npx",
      args: ["wrangler", "secret", "put", secret, "--name", name],
    })
  const previewSecret = (secret, value) =>
    plans.push({
      label: `プレビュー（${develop}）`,
      name: secret,
      value,
      command: "npx",
      args: [
        "wrangler",
        "preview",
        "base-config",
        "secret",
        "put",
        secret,
        "--worker-name",
        develop,
      ],
    })

  each("github.variables", gh("variable", `GitHub Variables（${opts.repo}）`))
  each("github.secrets", gh("secret", `GitHub Secrets（${opts.repo}）`))
  for (const section of ["worker.secrets", "worker.secrets.production"]) {
    each(section, workerSecret(opts.worker))
  }
  for (const section of ["worker.secrets", "worker.secrets.develop"]) {
    each(section, workerSecret(develop))
    each(section, previewSecret)
  }
  return plans
}

/** 本番の Worker の名前を wrangler.template.jsonc の先頭の "name" から読む */
const readWorkerName = () => {
  const template = readFileSync(
    path.join(ROOT, "wrangler.template.jsonc"),
    "utf8",
  )
  const match = /"name"\s*:\s*"([^"]+)"/.exec(template)
  if (!match)
    throw new Error("wrangler.template.jsonc に Worker の名前がありません")
  return match[1]
}

/** `--key value` 形式の引数を読む */
const argValue = (args, key) => {
  const index = args.indexOf(key)
  return index >= 0 ? args[index + 1] : undefined
}

const main = () => {
  const args = process.argv.slice(2)
  const dryRun = args.includes("--dry-run")
  const file = path.resolve(
    argValue(args, "--file") ?? path.join(ROOT, "deploy.env"),
  )
  if (!existsSync(file)) {
    console.error(
      `${file} がありません（cp deploy.env.template deploy.env で作る）`,
    )
    process.exit(1)
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

  const sections = parseDeployEnv(readFileSync(file, "utf8"))
  const plans = planRegistrations(sections, {
    repo,
    worker: readWorkerName(),
    readFile: p => readFileSync(path.resolve(ROOT, p), "utf8"),
  })
  if (plans.length === 0) {
    console.log("登録する値がありません（値が空の行は登録しない）")
    return
  }

  // wrangler の認証に、deploy.env の Cloudflare の認証情報を使う（シェルの環境変数が優先）
  const secrets = sections["github.secrets"] ?? {}
  const env = { ...process.env }
  for (const name of ["CLOUDFLARE_API_TOKEN", "CLOUDFLARE_ACCOUNT_ID"]) {
    if (!env[name] && secrets[name]) env[name] = secrets[name]
  }

  let failed = 0
  for (const plan of plans) {
    if (dryRun) {
      console.log(`[dry-run] ${plan.label}: ${plan.name}`)
      continue
    }
    // 値は標準入力で渡し、出力には変数名と登録先だけを出す
    const result = spawnSync(plan.command, plan.args, {
      cwd: ROOT,
      env,
      input: plan.value,
      encoding: "utf8",
    })
    if (result.status === 0) {
      console.log(`登録しました ${plan.label}: ${plan.name}`)
    } else {
      failed++
      console.error(`失敗しました ${plan.label}: ${plan.name}`)
      console.error(`${result.stderr ?? ""}`.trim())
    }
  }
  if (failed > 0) process.exit(1)
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main()
}
