#!/usr/bin/env node
/**
 * BRW プラグインを SessionStart で冪等に導入する。無いものだけを claude CLI で行い、既にあれば導入の操作はしない。
 * 導入の前に失敗の記録（.cache/brw-plugin-install.failed）を書き、成功したら消す。停止は install-gate.mjs が行う。
 * 使い方: node scripts/agent/ensure-brw-plugin.mjs（引数なし）。終了コードは常に 0（SessionStart は止められない）。
 */
import { spawnSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const scriptDir = path.dirname(fileURLToPath(import.meta.url))
export const repoRoot = path.resolve(scriptDir, "../..")
export const MARKETPLACE = "nekono-dev"
export const MARKETPLACE_SOURCE = "nekono-dev/claude-plugins"
export const PLUGIN = "branch-release-workflow@nekono-dev"
export const RECORD = ".cache/brw-plugin-install.failed"
// CLI とスクリプト全体の時間制限
const CLI_TIMEOUT_MS = Number(process.env.SKYSHARE_BRW_CLI_TIMEOUT_MS) || 60000
const TOTAL_BUDGET_MS =
  Number(process.env.SKYSHARE_BRW_TOTAL_BUDGET_MS) || 170000

/** marketplace の JSON 一覧に、名前が完全一致する項目があるか。 */
export const isMarketplaceListed = (listJson, name) => {
  try {
    const list = JSON.parse(listJson)
    return Array.isArray(list) && list.some(entry => entry?.name === name)
  } catch {
    return false
  }
}

const samePath = (a, b) => {
  try {
    return fs.realpathSync(a) === fs.realpathSync(b)
  } catch {
    return path.resolve(a) === path.resolve(b)
  }
}

/** `claude plugin list --json` の出力に、このプロジェクトの scope project の PLUGIN があるか。 */
export const hasProjectPlugin = (listJson, projectPath) => {
  try {
    const list = JSON.parse(listJson)
    return list.some(
      entry =>
        entry.id === PLUGIN &&
        entry.scope === "project" &&
        typeof entry.projectPath === "string" &&
        samePath(entry.projectPath, projectPath),
    )
  } catch {
    return false
  }
}

/** 既存の状態から、行う導入の操作を決める（無いものだけ）。 */
export const decideInstall = ({ marketplaceListed, pluginInstalled }) => ({
  addMarketplace: !marketplaceListed,
  installPlugin: !pluginInstalled,
})

/** 導入の文言。失敗の記録と、新しいセッションでの再試行を示す。 */
export const retryMessage = operation =>
  `BRW の導入に失敗しました（${operation}）。新しいセッションを開くと再試行されます。すぐに直す場合は、Claude の外（通常のターミナル）で node scripts/agent/ensure-brw-plugin.mjs を実行してください。`

/** 失敗の記録を書く（導入の前と失敗の時に使う）。 */
export const writeRecord = (root, text) => {
  const file = path.join(root, RECORD)
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, `${new Date().toISOString()} ${text}\n`)
}

/** 失敗の記録を消す（導入が成功した時）。 */
export const clearRecord = root =>
  fs.rmSync(path.join(root, RECORD), { force: true })

const run = (args, cwd, timeout = CLI_TIMEOUT_MS) =>
  spawnSync("claude", args, { cwd, encoding: "utf8", timeout })

const logErr = text => fs.writeSync(2, `${text}\n`)

/** 導入の本体。戻り値は、導入を行ったかと、失敗の内容（失敗しなければ null）。 */
export const ensureBrw = (
  root,
  runner = run,
  now = Date.now,
  startedAt = now(),
  limits = {},
) => {
  const cliTimeoutMs = limits.cliTimeoutMs ?? CLI_TIMEOUT_MS
  const totalBudgetMs = limits.totalBudgetMs ?? TOTAL_BUDGET_MS
  const remaining = () => Math.max(0, totalBudgetMs - (now() - startedAt))
  const invoke = args => {
    const timeLeft = remaining()
    if (!timeLeft)
      return {
        status: null,
        stdout: "",
        stderr: "",
        error: { code: "ETIMEDOUT" },
      }
    return runner(args, root, Math.min(cliTimeoutMs, timeLeft))
  }
  const list = invoke(["plugin", "marketplace", "list", "--json"])
  if (list.error?.code === "ENOENT") return { skipped: true }
  if (list.status !== 0) return { failure: "marketplace の一覧の取得" }
  const decision = decideInstall({
    marketplaceListed: isMarketplaceListed(list.stdout, MARKETPLACE),
    pluginInstalled: hasProjectPlugin(
      invoke(["plugin", "list", "--json"]).stdout ?? "[]",
      root,
    ),
  })
  if (!decision.addMarketplace && !decision.installPlugin)
    return { installed: false, present: true }

  // 導入の前に記録を書く。途中で中断されても、記録が残り、次の入力まで止まる
  writeRecord(root, "導入中（完了していない）")
  if (decision.addMarketplace) {
    const add = invoke([
      "plugin",
      "marketplace",
      "add",
      MARKETPLACE_SOURCE,
      "--scope",
      "project",
    ])
    if (add.status !== 0)
      return { failure: "marketplace の登録", output: add.stderr }
  }
  if (decision.installPlugin) {
    const install = invoke([
      "plugin",
      "install",
      PLUGIN,
      "--scope",
      "project",
      "--yes",
    ])
    if (install.status !== 0)
      return { failure: "プラグインの導入", output: install.stderr }
  }
  return { installed: true }
}

export const main = (
  root = process.env.CLAUDE_PROJECT_DIR || repoRoot,
  runner = run,
  now = Date.now,
  stderr = logErr,
  limits = {},
) => {
  const cliTimeoutMs = limits.cliTimeoutMs ?? CLI_TIMEOUT_MS
  const totalBudgetMs = limits.totalBudgetMs ?? TOTAL_BUDGET_MS
  const startedAt = now()
  const remaining = () => Math.max(0, totalBudgetMs - (now() - startedAt))
  const result = ensureBrw(root, runner, now, startedAt, {
    cliTimeoutMs,
    totalBudgetMs,
  })
  if (result.skipped) {
    stderr("claude コマンドが無いため、BRW の導入を飛ばします。")
    return
  }
  if (result.failure) {
    writeRecord(root, `導入の失敗: ${result.failure}`)
    stderr(retryMessage(result.failure))
    if (result.output) stderr(result.output.trim())
    return
  }
  if (result.installed || result.present) {
    // 導入が済んでいる（今回の導入の成功、または既に導入済み）。古い記録は消す
    clearRecord(root)
    if (result.installed)
      stderr(
        "BRW を導入しました。スキルが使えない場合は、セッションを開き直してください。",
      )
  }
  // 更新の失敗は作業を止めない
  const timeLeft = remaining()
  if (!timeLeft) {
    stderr("BRW の更新は全体の時間予算が残っていないため飛ばします。")
    return
  }
  const update = runner(
    ["plugin", "update", PLUGIN],
    root,
    Math.min(cliTimeoutMs, timeLeft),
  )
  if (update.status !== 0)
    stderr(
      `BRW の更新に失敗しました（導入済みの版で続行します）: ${update.stderr ?? ""}`.trim(),
    )
}

const isDirectRun =
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isDirectRun) {
  try {
    main()
  } catch (error) {
    // 想定外の例外も、SessionStart を止めない。記録は導入の前に書かれている
    process.stderr.write(
      `ensure-brw-plugin: ${error instanceof Error ? error.message : String(error)}\n`,
    )
  }
  process.exitCode = 0
}
