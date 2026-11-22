#!/usr/bin/env node
/**
 * BRW（branch-release-workflow）の CLI を、導入済みのプラグインから呼び出す入口。
 * 使い方: npm run brw -- <サブコマンド> [引数]（例: npm run brw -- check / npm run brw -- create 名前）
 * 探す順番: 環境変数 BRW_DIR（BRW の clone のパス）→ claude のプロジェクト scope に導入したプラグイン。
 * 見つからない場合は、導入の手順（node scripts/agent/ensure-brw-plugin.mjs）を示して終了コード 1 で終わる。
 */
import { spawnSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const scriptDir = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(scriptDir, "../..")
const PLUGIN = "branch-release-workflow@nekono-dev"

const samePath = (a, b) => {
  try {
    return fs.realpathSync(a) === fs.realpathSync(b)
  } catch {
    return path.resolve(a) === path.resolve(b)
  }
}

/** 今のリポジトリ（worktree なら本体）に導入されたプラグインの CLI のパス。無ければ null。 */
export const findBrwCli = (root = repoRoot, env = process.env) => {
  if (env.BRW_DIR) {
    const cli = path.join(env.BRW_DIR, "scripts/brw.mjs")
    return fs.existsSync(cli) ? cli : null
  }
  const list = spawnSync("claude", ["plugin", "list", "--json"], {
    cwd: root,
    encoding: "utf8",
    timeout: 60000,
  })
  if (list.status !== 0) return null
  try {
    const entries = JSON.parse(list.stdout).filter(
      entry => entry.id === PLUGIN && entry.scope === "project",
    )
    // worktree でも本体でも使えるよう、git の共通ディレクトリから本体のパスを求める
    const common = spawnSync(
      "git",
      ["rev-parse", "--path-format=absolute", "--git-common-dir"],
      { cwd: root, encoding: "utf8" },
    ).stdout.trim()
    const candidates = [root, path.dirname(common)]
    const hit = entries.find(entry =>
      candidates.some(
        dir => entry.projectPath && samePath(entry.projectPath, dir),
      ),
    )
    const cli = hit && path.join(hit.installPath, "scripts/brw.mjs")
    return cli && fs.existsSync(cli) ? cli : null
  } catch {
    return null
  }
}

const isDirectRun =
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isDirectRun) {
  const cli = findBrwCli()
  if (!cli) {
    process.stderr.write(
      "BRW が見つかりません。node scripts/agent/ensure-brw-plugin.mjs で導入するか、BRW の clone を環境変数 BRW_DIR に指定してください。\n",
    )
    process.exit(1)
  }
  const result = spawnSync(process.execPath, [cli, ...process.argv.slice(2)], {
    stdio: "inherit",
  })
  process.exit(result.status ?? 1)
}
