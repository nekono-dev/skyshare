/**
 * Mermaid の構文検証（mermaid.parse）。
 *
 * - 依存（mermaid・jsdom）は scripts/package.json で完全固定し、scripts/node_modules に導入する。
 *   プロジェクトのルートの package.json・node_modules には触れない。
 * - 依存が無い・版が違うときは SetupError を投げる（検証を黙って省かない）。
 * - 使う API は mermaid.parse のみ。図の中身（ノード・辺）の取得は mermaid の内部 API に依存するため行わない。
 */
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { SetupError } from "./lib.mjs"

const dir = path.dirname(fileURLToPath(import.meta.url))
const MIN_NODE = [22, 12] // mermaid の engines（>=22.12.0）

const readJson = file => {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"))
  } catch {
    return null
  }
}

/** 導入状態を調べる。問題がなければ null、あれば導入手順を含む案内文を返す */
export function setupProblem() {
  const pkg = readJson(path.join(dir, "package.json"))
  if (!pkg) return `${dir}/package.json を読めない`
  const problems = []
  const [major, minor] = process.versions.node.split(".").map(Number)
  if (major < MIN_NODE[0] || (major === MIN_NODE[0] && minor < MIN_NODE[1]))
    problems.push(
      `Node ${process.versions.node}（必要: ${MIN_NODE.join(".")} 以上）`,
    )
  for (const [name, want] of Object.entries(pkg.dependencies ?? {})) {
    const have = readJson(path.join(dir, "node_modules", name, "package.json"))
    if (!have) problems.push(`${name} が未導入`)
    else if (have.version !== want)
      problems.push(`${name} が ${have.version}（必要: ${want}）`)
  }
  if (problems.length === 0) return null
  const rel = path.relative(process.cwd(), dir) || "."
  return [
    `Mermaid の構文検証に必要な環境が揃っていない: ${problems.join("、")}`,
    "依存を次のコマンドで導入する（Node 22.12 以上が必要）:",
    `  npm ci --ignore-scripts --prefix ${rel}`,
  ].join("\n")
}

let loading = null

/** jsdom を window／document として注入してから mermaid を読み込む（初回のみ） */
function loadMermaid() {
  loading ??= (async () => {
    const problem = setupProblem()
    if (problem) throw new SetupError(problem)
    const { JSDOM } = await import("jsdom")
    const dom = new JSDOM("<!doctype html><html><body></body></html>")
    globalThis.window = dom.window
    globalThis.document = dom.window.document
    const { default: mermaid } = await import("mermaid")
    mermaid.initialize({ startOnLoad: false })
    return mermaid
  })()
  return loading
}

/**
 * 図の構文を検証する。lines は mermaid ブロックの中身（{ no, text }）。
 * 構文エラーがなければ null、あれば { no, message } を返す。
 */
export async function syntaxError(lines, fallbackNo) {
  const mermaid = await loadMermaid()
  // コメント行は mermaid が行ごと除くため、空行にして行番号を保つ
  const text = lines
    .map(l => (l.text.trim().startsWith("%%") ? "" : l.text))
    .join("\n")
  try {
    await mermaid.parse(text)
    return null
  } catch (e) {
    const msg = String(e?.message ?? e)
    const at = /^Parse error on line (\d+):/.exec(msg)
    const line = at ? lines[Number(at[1]) - 1] : undefined
    if (!line)
      return {
        no: fallbackNo,
        message: `Mermaid が図として解釈できない（${msg.split("\n")[0]}）`,
      }
    const got = /got '([^']*)'/.exec(msg)?.[1]
    return {
      no: line.no,
      message: `「${line.text.trim()}」を Mermaid が構文エラーとして扱う${got ? `（想定外のトークン: ${got}）` : ""}`,
    }
  }
}
