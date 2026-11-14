#!/usr/bin/env node
/**
 * マイグレーションの運用規則を検査する（コミット前・test:all・CI）。
 * 使い方: `node scripts/git/check-migrations.mjs [--branch 名] [--base 名] [--root 場所] [--index]`
 * ブランチは引数・CI の環境変数・現在のブランチの順に決め、決められないときは通す。`--index` はステージ済みの一覧を見る。
 */
import { execFileSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import {
  findMigrationViolations,
  isInitialOnlyRequired,
  ruleMessage,
} from "./migration-rule.mjs"

const scriptDir = path.dirname(fileURLToPath(import.meta.url))

/** `--名前 値` の値を返す。無ければ undefined。 */
const argValue = (args, name) => {
  const index = args.indexOf(name)
  return index >= 0 ? args[index + 1] : undefined
}

/** ステージ済み（インデックス）のマイグレーションの置き場の直下のファイル名。 */
const indexedNames = root => {
  const listing = execFileSync(
    "git",
    ["-C", root, "ls-files", "--cached", "-z", "--", "migrations"],
    { encoding: "utf8" },
  )
  return listing
    .split("\0")
    .filter(line => /^migrations\/[^/]+$/.test(line))
    .map(line => line.slice("migrations/".length))
}

/** 現在のブランチ名。取れなければ空文字。 */
const currentBranch = root => {
  try {
    return execFileSync("git", ["-C", root, "branch", "--show-current"], {
      encoding: "utf8",
    }).trim()
  } catch {
    return ""
  }
}

const main = () => {
  const args = process.argv.slice(2)
  const root = path.resolve(
    argValue(args, "--root") ?? path.resolve(scriptDir, "../.."),
  )
  const branch =
    argValue(args, "--branch") ||
    process.env.GITHUB_HEAD_REF ||
    process.env.GITHUB_REF_NAME ||
    currentBranch(root)
  const baseBranch = argValue(args, "--base") || process.env.GITHUB_BASE_REF

  if (!branch) {
    process.stderr.write(
      "check-migrations: ブランチを決められないため判定しない\n",
    )
    return 0
  }
  if (!isInitialOnlyRequired({ branch, baseBranch })) return 0

  const directory = path.join(root, "migrations")
  const workingNames = fs.existsSync(directory) ? fs.readdirSync(directory) : []
  const names = args.includes("--index") ? indexedNames(root) : workingNames
  const violations = findMigrationViolations(names)
  if (violations.length === 0) return 0

  process.stderr.write(
    `${ruleMessage}\n対象のブランチ: ${branch}${baseBranch ? `（ベース: ${baseBranch}）` : ""}\n反するファイル: ${violations.join(", ")}\n`,
  )
  return 1
}

process.exit(main())
