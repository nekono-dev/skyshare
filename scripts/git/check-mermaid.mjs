/**
 * Markdown 内の ```mermaid ブロックを、Mermaid 本体の構文解析で検査する。
 * 既定はリポジトリで追跡している全 .md、`--index` はコミット予定（ステージ済み）の .md だけを、ステージ済みの内容で検査する（`--fix` と併せるときは作業ツリーの内容）。
 * 構文エラーがあれば「ファイル:行」と原因を表示して終了コード 1 で終わる。
 * `--fix` を付けると、機械的に直せるもの（ラベルの記号を二重引用符で囲む）を直し、直した結果が構文解析を通るときだけ書き戻す。
 * 解析は描画を伴わないため、ブラウザは使わず jsdom の最小の DOM で動かす。
 */
import { spawnSync } from "node:child_process"
import { readFileSync, writeFileSync } from "node:fs"
import { fileURLToPath } from "node:url"

/** Markdown 本文から mermaid ブロックを取り出す。line は開始フェンスの行番号（1 始まり）。 */
export function extractMermaidBlocks(markdown) {
  const lines = markdown.split("\n")
  const blocks = []
  let current = null
  lines.forEach((text, index) => {
    if (current === null) {
      if (/^ {0,3}```+\s*mermaid\s*$/.test(text)) {
        current = { line: index + 1, body: [] }
      }
      return
    }
    if (/^ {0,3}```+\s*$/.test(text)) {
      blocks.push({ line: current.line, source: current.body.join("\n") })
      current = null
      return
    }
    current.body.push(text)
  })
  // 閉じていないフェンスもエラーとして扱う
  if (current !== null) {
    blocks.push({
      line: current.line,
      source: current.body.join("\n"),
      unclosed: true,
    })
  }
  return blocks
}

/**
 * 括弧・矢印ラベルの中身が記号を含むとき、二重引用符で囲む（Mermaid の公式な回避方法）。
 * 既に引用符で囲まれたものと、`[(`・`((` などの形状記号は変えない。
 */
export function quoteLabels(source) {
  const special = /[()/*@&#;:<>'`]/
  const wrap = (open, text, close) =>
    special.test(text) && !/^\s*["`]/.test(text) && !/^[([{>/\\]/.test(text)
      ? `${open}"${text.replaceAll('"', "#quot;")}"${close}`
      : `${open}${text}${close}`
  return source
    .split("\n")
    .map(line => {
      if (
        /^\s*(%%|flowchart|graph|subgraph|end\b|style|classDef|class|click|linkStyle)/.test(
          line,
        )
      ) {
        return line
      }
      return line
        .replace(/(\w)\[([^\]"]+)\]/g, (_, id, text) =>
          wrap(`${id}[`, text, "]"),
        )
        .replace(/(\w)\{([^}"]+)\}/g, (_, id, text) =>
          wrap(`${id}{`, text, "}"),
        )
        .replace(/(--|==)\s+([^-=>|"]+?)\s+(-->|---|==>)/g, (_, a, text, b) =>
          special.test(text)
            ? `${a} "${text.trim()}" ${b}`
            : `${a} ${text} ${b}`,
        )
    })
    .join("\n")
}

/** 直せるブロックだけ直した Markdown を返す。直しても通らないブロックは元のままにする。 */
export async function fixMarkdown(mermaid, markdown) {
  const lines = markdown.split("\n")
  const blocks = extractMermaidBlocks(markdown)
    .filter(block => !block.unclosed)
    .reverse()
  for (const block of blocks) {
    try {
      await mermaid.parse(block.source)
      continue
    } catch {
      // 直せるか試す
    }
    const fixed = quoteLabels(block.source)
    if (fixed === block.source) continue
    try {
      await mermaid.parse(fixed)
    } catch {
      continue
    }
    const count = block.source.split("\n").length
    lines.splice(block.line, count, ...fixed.split("\n"))
  }
  return lines.join("\n")
}

async function loadMermaid() {
  const { JSDOM } = await import("jsdom")
  const dom = new JSDOM("<!doctype html><body></body>")
  globalThis.window = dom.window
  globalThis.document = dom.window.document
  return (await import("mermaid")).default
}

/** 1 ファイル分を検査し、エラーの一覧（行・内容）を返す。 */
export async function checkMarkdown(mermaid, markdown) {
  const errors = []
  for (const block of extractMermaidBlocks(markdown)) {
    if (block.unclosed) {
      errors.push({
        line: block.line,
        message: "mermaid ブロックが閉じられていない",
      })
      continue
    }
    try {
      await mermaid.parse(block.source)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      errors.push({ line: block.line, message })
    }
  }
  return errors
}

function git(args) {
  const result = spawnSync("git", args, {
    encoding: "buffer",
    maxBuffer: 1 << 28,
  })
  if (result.status !== 0) throw new Error(`git ${args.join(" ")} failed`)
  return result.stdout
}

function listTargets(useIndex) {
  const args = useIndex
    ? ["diff", "--cached", "--name-only", "--diff-filter=ACMR", "-z"]
    : ["ls-files", "-z"]
  return git(args)
    .toString("utf8")
    .split("\0")
    .filter(file => file.endsWith(".md"))
}

function readTarget(file, useIndex) {
  return useIndex
    ? git(["show", `:${file}`]).toString("utf8")
    : readFileSync(file, "utf8")
}

async function main() {
  const useIndex = process.argv.includes("--index")
  const fix = process.argv.includes("--fix")
  const targets = listTargets(useIndex)
  if (targets.length === 0) return 0
  const mermaid = await loadMermaid()
  let failed = 0
  for (const file of targets) {
    // 直すときは作業ツリーの内容を対象にする（フックが直した後にステージし直す）
    let markdown = readTarget(file, useIndex && !fix)
    if (!markdown.includes("mermaid")) continue
    if (fix) {
      const fixed = await fixMarkdown(mermaid, markdown)
      if (fixed !== markdown) {
        writeFileSync(file, fixed)
        markdown = fixed
        console.error(`${file}: mermaid を自動で直した`)
      }
    }
    for (const error of await checkMarkdown(mermaid, markdown)) {
      failed += 1
      console.error(
        `${file}:${error.line}: mermaid の構文エラー\n${error.message}\n`,
      )
    }
  }
  if (failed > 0) console.error(`mermaid: ${failed} 件の構文エラー`)
  return failed > 0 ? 1 : 0
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().then(
    code => process.exit(code),
    error => {
      console.error(error)
      process.exit(2)
    },
  )
}
