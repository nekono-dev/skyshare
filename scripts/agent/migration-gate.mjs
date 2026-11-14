#!/usr/bin/env node
/**
 * release/** 以外のブランチで、初期状態の SQL 以外のマイグレーションを作る・書く操作を止める（PreToolUse のフック）。
 * 対象は Write・Edit・MultiEdit のパスと、Bash の作成コマンド・マイグレーションの置き場の SQL への書き込み。
 * 判定できないとき（ブランチ不明・例外）は止めない。入力はフックの標準入力の JSON。
 */
import { execFileSync } from "node:child_process"
import path from "node:path"
import { fileURLToPath } from "node:url"
import {
  INITIAL_FILE,
  isLaterMigrationPath,
  isReleaseBranch,
  ruleMessage,
} from "../git/migration-rule.mjs"

const scriptDir = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(scriptDir, "../..")

/** 利用者に示す拒否の理由。 */
export const gateReason = `${ruleMessage}この操作は止めた。`

/** マイグレーションの置き場の SQL を指す文字列（コマンド中）。グロブ（*）の記述は対象にしない。 */
const MIGRATION_IN_COMMAND = /migrations\/([^\s'"/*\\]+\.sql)/g
const CREATE_COMMAND = /d1\s+migrations\s+create/

/**
 * ツールの使用を止めるか決める。
 *
 * Input: ツール名・入力・現在のブランチ（不明なら null）
 * Output: 止める理由、止めないなら null。ブランチが不明、または release/** なら null
 * 例: Write で `migrations/0002_x.sql`、ブランチ `develop` → 理由
 */
export const decideMigrationToolUse = (toolName, toolInput, branch) => {
  if (!branch || isReleaseBranch(branch)) return null
  if (["Write", "Edit", "MultiEdit"].includes(toolName)) {
    const filePath = String(toolInput?.file_path ?? "")
    return isLaterMigrationPath(filePath) ? gateReason : null
  }
  if (toolName === "Bash") {
    const command = String(toolInput?.command ?? "")
    const writesOther = [...command.matchAll(MIGRATION_IN_COMMAND)].some(
      match => match[1] !== INITIAL_FILE,
    )
    return CREATE_COMMAND.test(command) || writesOther ? gateReason : null
  }
  return null
}

/** フックの入力の作業場所のブランチ。取れなければ null。 */
const branchOf = cwd => {
  try {
    const name = execFileSync(
      "git",
      ["-C", cwd || repoRoot, "branch", "--show-current"],
      { encoding: "utf8" },
    ).trim()
    return name || null
  } catch {
    return null
  }
}

const main = async () => {
  if (process.argv[2] !== "pre-tool-use") {
    throw new Error(`未知のイベント: ${process.argv[2]}`)
  }
  const raw = await new Promise(resolve => {
    let data = ""
    process.stdin.setEncoding("utf8")
    process.stdin.on("data", chunk => (data += chunk))
    process.stdin.on("end", () => resolve(data))
    process.stdin.on("error", () => resolve(data))
  })
  const input = raw.trim() ? JSON.parse(raw) : {}
  const reason = decideMigrationToolUse(
    input.tool_name,
    input.tool_input ?? {},
    branchOf(input.cwd),
  )
  if (reason) {
    process.stdout.write(
      JSON.stringify({
        hookSpecificOutput: {
          hookEventName: "PreToolUse",
          permissionDecision: "deny",
          permissionDecisionReason: reason,
        },
      }),
    )
  }
}

const isDirectRun =
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isDirectRun) {
  main().catch(error => {
    process.stderr.write(
      `migration-gate: ${error instanceof Error ? error.message : String(error)}\n`,
    )
    process.exit(0)
  })
}
