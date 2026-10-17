/**
 * 自己テストの共通部（雛形から検証用のリポジトリを組み立て、チェックを実行する）。
 */
import { after } from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { spawnSync } from "node:child_process"
import { fileURLToPath } from "node:url"
import { setupProblem } from "./mermaid-syntax.mjs"

export const here = path.dirname(fileURLToPath(import.meta.url))
export const skill = path.dirname(here)
export const templates = path.join(skill, "templates")

// 依存が未導入なら案内文（導入済みなら null）
export const depsProblem = setupProblem()

export const roots = []
after(() =>
  roots.forEach((r) => fs.rmSync(r, { recursive: true, force: true })),
)

/** 雛形から spec を作る。edits: { "<spec>/<file>": (text) => text } */
export function makeRoot(edits = {}, specNames = ["sample"]) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "spec-selftest-"))
  roots.push(root)
  const specs = path.join(root, "specs")
  for (const name of specNames) {
    fs.mkdirSync(path.join(specs, name), { recursive: true })
    for (const f of ["requirements.md", "design.md", "tasks.md"]) {
      fs.copyFileSync(path.join(templates, f), path.join(specs, name, f))
    }
  }
  for (const [key, fn] of Object.entries(edits)) {
    const p = path.join(specs, key)
    fs.mkdirSync(path.dirname(p), { recursive: true })
    const before = fs.existsSync(p) ? fs.readFileSync(p, "utf8") : ""
    if (fn === null) fs.rmSync(p, { force: true })
    else fs.writeFileSync(p, fn(before))
  }
  return root
}

export const checkAll = path.join(here, "check-all.mjs")

/** 構文検証を省いて実行する */
export function run(root, ...args) {
  return runWith(checkAll, root, ["--no-syntax", ...args])
}

/** 構文検証つきで実行する（依存が未導入なら省く） */
export function runFull(root, ...args) {
  return runWith(checkAll, root, [
    ...(depsProblem ? ["--no-syntax"] : []),
    ...args,
  ])
}

export function runWith(script, root, args) {
  const r = spawnSync(
    process.execPath,
    [script, "--root", "specs", "--json", ...args],
    {
      cwd: root,
      encoding: "utf8",
    },
  )
  return {
    code: r.status,
    findings: r.stdout.trim() === "" ? [] : JSON.parse(r.stdout),
    stderr: r.stderr,
  }
}

export const rulesOf = (findings) =>
  [...new Set(findings.map((f) => f.rule))].sort()
