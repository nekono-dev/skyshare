#!/usr/bin/env node
/**
 * CI 用に、BRW（branch-release-workflow）の取得元の clone を作り、その絶対パスを標準出力へ出す。
 * 取得元は .branch-release-workflow-source.json。CI（deploy・preview）が BRW_PLUGIN_DIR に使う。
 * 開発機への導入は行わない（BRW は .claude/settings.json の marketplace 宣言で有効にする）。
 * Input: なし。Gitの診断は標準エラーへ出す。
 * 例: BRW_PLUGIN_DIR=$(node scripts/agent/setup-brw.mjs)
 */
import { execFileSync } from "node:child_process"
import { existsSync, mkdirSync } from "node:fs"
import { homedir } from "node:os"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { readBrwSource } from "./brwSource.mjs"

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..")
if (process.argv.length > 2) {
  throw new Error(
    "使い方: node scripts/agent/setup-brw.mjs（引数は取りません）",
  )
}
// 取得元は追跡されたファイル。無い・不正なら、原因が分かる文言で止める（検査は brwSource.mjs）
const { repository, branch } = readBrwSource(
  join(root, ".branch-release-workflow-source.json"),
)
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
console.log(clone)
