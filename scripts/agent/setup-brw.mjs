#!/usr/bin/env node
/**
 * 共有skill（branch-release-workflow）を外部Gitリポジトリの指定ブランチの最新コミットで取得する。
 * 引数なし: clone の絶対パスを標準出力へ出す（CI が BRW_PLUGIN_DIR に使う）。
 * --install: 同じ clone から Claude と Codex の両方へ導入する（ローカルとクラウドの SessionStart、npm run setup:brw）。
 * Input: .branch-release-workflow-source.json。Gitの診断と導入ログは標準エラーへ出す。
 * 例: npm run setup:brw / BRW_PLUGIN_DIR=$(node scripts/agent/setup-brw.mjs)
 */
import { execFileSync } from "node:child_process"
import { existsSync, mkdirSync, readFileSync } from "node:fs"
import { homedir } from "node:os"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { isMarketplaceListed } from "../lib/claudeMarketplace.mjs"

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..")
const args = process.argv.slice(2)
if (args.length > 1 || (args.length === 1 && args[0] !== "--install")) {
  throw new Error("使い方: node scripts/agent/setup-brw.mjs [--install]")
}
const install = args[0] === "--install"
// 取得元は追跡されたファイル。無いと CI が BRW を取れないため、欠落は原因が分かる文言で止める
const sourcePath = join(root, ".branch-release-workflow-source.json")
if (!existsSync(sourcePath)) {
  throw new Error(
    `取得元のファイルがありません: ${sourcePath}（リポジトリに追跡されているか確認してください）`,
  )
}
const { repository, branch } = JSON.parse(readFileSync(sourcePath, "utf8"))
if (
  typeof repository !== "string" ||
  !/^https:\/\/github\.com\/[\w.-]+\/[\w.-]+\.git$/.test(repository) ||
  typeof branch !== "string" ||
  !/^[a-zA-Z0-9][a-zA-Z0-9._/-]*$/.test(branch)
) {
  throw new Error(
    "skillの取得元にはGitHubのHTTPS URLとブランチ名を指定してください",
  )
}
const clone = join(
  process.env.RUNNER_TEMP ?? join(homedir(), ".cache/skyshare"),
  "brw",
)
mkdirSync(clone, { recursive: true })
/**
 * 指定したclone内でGitを実行し、診断を標準エラーへ出す。
 * Input: Gitの引数配列。Output: 標準出力の文字列。
 * 例: git(["rev-parse", "HEAD"]) は現在のSHAを返す。
 */
const git = args =>
  execFileSync("git", ["-C", clone, ...args], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "inherit"],
  }).trim()
if (!existsSync(join(clone, ".git"))) git(["init", "-q"])
// 各実行で指定ブランチの最新コミットを取り込み、cloneを更新する。
git(["check-ref-format", "--branch", branch])
git(["fetch", "-q", "--depth", "1", repository, `refs/heads/${branch}`])
git(["checkout", "-q", "--detach", "--force", "FETCH_HEAD"])
if (git(["rev-parse", "HEAD"]) !== git(["rev-parse", "FETCH_HEAD"]))
  throw new Error("取得したskillのブランチ先頭と一致しません")
if (install) {
  installCodex(clone)
  installClaude(clone)
}
console.log(clone)

/**
 * Codex へ導入する。clone の scripts/install-codex.mjs が、.agents/skills/ へ symlink を作る（BRW 本体の方式）。
 */
function installCodex(clone) {
  process.stderr.write(
    execFileSync(
      process.execPath,
      [
        join(clone, "scripts/install-codex.mjs"),
        "--skills-dir",
        join(root, ".agents/skills"),
      ],
      { encoding: "utf8", stdio: ["ignore", "pipe", "inherit"] },
    ),
  )
}

/**
 * Claude へ導入する。clone をユーザースコープのマーケットプレイスとして登録し、
 * プロジェクトのスコープでプラグインを有効にする（.claude/settings.json の enabledPlugins と同じ内容のため差分は出ない）。
 * claude コマンドが無い環境（Codex だけの運用者）では飛ばす。
 * 注意: 同名（nekono-dev）の既存の登録があれば外してから、clone を登録し直す。
 */
function installClaude(clone) {
  const claude = (cliArgs, options = {}) =>
    execFileSync("claude", ["plugin", ...cliArgs], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "inherit"],
      ...options,
    })
  try {
    claude(["--help"], { stdio: "ignore" })
  } catch {
    process.stderr.write(
      "claude コマンドが無いため、Claude への導入を飛ばします\n",
    )
    return
  }
  // 登録があるときだけ外す。外すときは全てのスコープから外す（user に宣言が無い登録もあるため --scope を付けない）
  if (isMarketplaceListed(claude(["marketplace", "list"]), "nekono-dev")) {
    claude(["marketplace", "remove", "nekono-dev"])
  }
  claude(["marketplace", "add", clone, "--scope", "user"])
  claude(
    [
      "install",
      "branch-release-workflow@nekono-dev",
      "--scope",
      "project",
      "--yes",
    ],
    { cwd: root },
  )
}
