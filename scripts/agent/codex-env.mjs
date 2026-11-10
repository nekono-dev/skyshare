/**
 * 起動時に `codex` と `git` の有無と、リポジトリの根を求める部品。
 * - 実行ファイルかは存在と実行権限で確かめる。codex は起動せず、外部への通信もしない。
 * - git の rev-parse が失敗したとき、または空の出力のときは利用できないものとして扱う。
 */
import { spawnSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"

/**
 * PATH 形式の文字列から、名前の実行ファイルを探す。見つからなければ null。
 * 空の要素は無視する（カレントディレクトリを暗黙に探さないため）。
 * @param {string} name
 * @param {string} searchPath
 * @returns {string | null}
 */
const findExecutable = (name, searchPath) => {
  for (const dir of searchPath.split(path.delimiter)) {
    if (dir === "") continue
    const candidate = path.join(dir, name)
    try {
      if (fs.statSync(candidate).isFile()) {
        fs.accessSync(candidate, fs.constants.X_OK)
        return candidate
      }
    } catch {
      // 存在しない・実行できない候補は次の候補へ進む
    }
  }
  return null
}

/**
 * git で作業ツリーの根を求める。得られなければ null。
 * @param {string} gitPath
 * @param {string} startDir
 * @returns {string | null}
 */
const findRepoRoot = (gitPath, startDir) => {
  const result = spawnSync(
    gitPath,
    ["-C", startDir, "rev-parse", "--show-toplevel"],
    { encoding: "utf8" },
  )
  if (result.error || result.status !== 0) return null
  const root = result.stdout.trim()
  if (root === "") return null
  try {
    return fs.statSync(root).isDirectory() ? root : null
  } catch {
    return null
  }
}

/**
 * codex と git を探し、揃っていればリポジトリの根を返す。
 * @param {{ searchPath: string, startDir: string }} options
 * @returns {Promise<{ available: true, repoRoot: string } | { available: false, missing: Array<"codex" | "git"> }>}
 */
export const probeEnvironment = async ({ searchPath, startDir }) => {
  const codexPath = findExecutable("codex", searchPath)
  const gitPath = findExecutable("git", searchPath)

  const missing = []
  if (codexPath === null) missing.push("codex")
  if (gitPath === null) missing.push("git")
  if (missing.length > 0) return { available: false, missing }

  const repoRoot = findRepoRoot(gitPath, startDir)
  if (repoRoot === null) return { available: false, missing: ["git"] }
  return { available: true, repoRoot }
}
