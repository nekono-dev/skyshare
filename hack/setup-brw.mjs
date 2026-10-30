#!/usr/bin/env node
/**
 * 共有skillを外部Gitリポジトリから固定コミットで取得し、必要ならCodexへ登録する。
 * Input: .branch-release-workflow-source.json、引数 --codex（省略時はCI向け取得のみ）。
 * Output: clone の絶対パスを標準出力へ出す。Gitの診断と導入ログは標準エラーへ出す。
 * 例: npm run setup:brw / BRW_PLUGIN_DIR=$(node hack/setup-brw.mjs)
 */
import { execFileSync } from "node:child_process"
import { existsSync, mkdirSync, readFileSync } from "node:fs"
import { homedir } from "node:os"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const args = process.argv.slice(2)
if (args.length > 1 || (args.length === 1 && args[0] !== "--codex")) {
  throw new Error("使い方: node hack/setup-brw.mjs [--codex]")
}
const { repository, ref } = JSON.parse(
  readFileSync(join(root, ".branch-release-workflow-source.json"), "utf8"),
)
if (
  typeof repository !== "string" ||
  !/^https:\/\/github\.com\/[\w.-]+\/[\w.-]+\.git$/.test(repository) ||
  !/^[a-f0-9]{40}$/.test(ref)
) {
  throw new Error(
    "skillの取得元にはGitHubのHTTPS URLと40桁のコミットSHAを指定してください",
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
// 各実行で固定SHAへ戻す。キャッシュを使う場合も、異なる版を誤って利用しない。
git(["fetch", "-q", "--depth", "1", repository, ref])
git(["checkout", "-q", "--detach", "--force", "FETCH_HEAD"])
if (git(["rev-parse", "HEAD"]) !== ref)
  throw new Error("取得したskillのSHAが一致しません")
if (args[0] === "--codex") {
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
console.log(clone)
