/**
 * 仕様書チェックスクリプト群の共通処理。
 *
 * - Markdown を行単位に分解し、コードブロック内かどうかを付与する。
 * - specs ルート配下の各 spec ディレクトリを読み込む。
 * - 指摘（finding）を決定的な順序で整列・出力する CLI を提供する。
 *
 * 外部依存を持たず、同じ入力に対して常に同じ出力を返す（冪等）。
 */
import fs from "node:fs"
import path from "node:path"

export const SPEC_FILES = ["requirements.md", "design.md", "tasks.md"]

/** 行配列へ分解する。フェンス行自身もコード扱いにする */
export function parseLines(text) {
  let inCode = false
  const lines = text.split(/\r?\n/)
  // 末尾の空行は行数に数えない
  while (lines.length > 0 && lines.at(-1).trim() === "") lines.pop()
  return lines.map((raw, i) => {
    if (/^\s*```/.test(raw)) {
      inCode = !inCode
      return { no: i + 1, text: raw, code: true, fence: true }
    }
    return { no: i + 1, text: raw, code: inCode, fence: false }
  })
}

export function headings(lines) {
  const out = []
  for (const l of lines) {
    if (l.code) continue
    const m = /^(#{1,6})\s+(.*?)\s*$/.exec(l.text)
    if (m) out.push({ level: m[1].length, text: m[2], no: l.no })
  }
  return out
}

/** H2 単位で分割する。最初の H2 より前は title=null のセクションになる */
export function sectionsByH2(lines) {
  const secs = [{ title: null, no: 0, lines: [] }]
  for (const l of lines) {
    const m = l.code ? null : /^##\s+(.*?)\s*$/.exec(l.text)
    if (m) secs.push({ title: m[1], no: l.no, lines: [] })
    else secs.at(-1).lines.push(l)
  }
  return secs
}

export const nonBlank = lines => lines.filter(l => l.text.trim() !== "")

export const isTableLine = l => !l.code && /^\s*\|/.test(l.text)

export const splitRow = text =>
  text
    .trim()
    .replace(/^\||\|$/g, "")
    .split("|")
    .map(s => s.trim())

/** requirements.md から FR/NFR の ID を抽出する */
export function requirementIds(file) {
  if (!file) return []
  const ids = []
  for (const l of file.lines) {
    const m = !l.code && /^- ((?:N?FR)-\d+): /.exec(l.text)
    if (m) ids.push(m[1])
  }
  return ids
}

/** design.md から D の ID を抽出する */
export function designIds(file) {
  if (!file) return []
  const ids = []
  for (const l of file.lines) {
    const m = !l.code && /^### (D-\d+):/.exec(l.text)
    if (m) ids.push(m[1])
  }
  return ids
}

const toPosix = p => p.split(path.sep).join("/")

export function listSpecNames(root) {
  return fs
    .readdirSync(root, { withFileTypes: true })
    .filter(e => e.isDirectory())
    .map(e => e.name)
    .sort()
}

export function loadSpec(root, name) {
  const dir = path.join(root, name)
  const entries = fs
    .readdirSync(dir, { withFileTypes: true })
    .map(e => ({ name: e.name, isDir: e.isDirectory() }))
    .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))
  const files = {}
  for (const f of SPEC_FILES) {
    const p = path.join(dir, f)
    if (fs.existsSync(p) && fs.statSync(p).isFile()) {
      files[f.replace(/\.md$/, "")] = {
        rel: toPosix(path.relative(process.cwd(), p)),
        lines: parseLines(fs.readFileSync(p, "utf8")),
      }
    }
  }
  return {
    name,
    dir,
    rel: toPosix(path.relative(process.cwd(), dir)),
    entries,
    files,
  }
}

export function finding(rel, line, rule, message) {
  return { file: rel, line, rule, message }
}

const cmp = (a, b) => (a < b ? -1 : a > b ? 1 : 0)

function sortFindings(list) {
  const seen = new Set()
  return list
    .slice()
    .sort(
      (a, b) =>
        cmp(a.file, b.file) ||
        a.line - b.line ||
        cmp(a.rule, b.rule) ||
        cmp(a.message, b.message),
    )
    .filter(f => {
      const key = `${f.file}\0${f.line}\0${f.rule}\0${f.message}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
}

/** ルール一覧を Markdown で出力する（references/rules.md の生成元） */
export function rulesMarkdown(modules) {
  const out = [
    "# 仕様書チェックルール一覧",
    "",
    "このファイルは `node scripts/check-all.mjs --rules` の出力である。手で編集しない。",
  ]
  for (const m of modules) {
    out.push("", `## ${m.title}`, "", "| ID | ルール |", "| --- | --- |")
    for (const [id, desc] of Object.entries(m.rules))
      out.push(`| ${id} | ${desc} |`)
  }
  return out.join("\n") + "\n"
}

/**
 * CLI 本体。
 * 使い方: <script> [--root specs] [--json] [--rules] [spec名...]
 * 終了コード: 0=指摘なし / 1=指摘あり / 2=引数エラー
 */
export function runCli(modules, argv = process.argv.slice(2)) {
  let rootArg = "specs"
  let json = false
  const names = []
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === "--root") rootArg = argv[++i]
    else if (a === "--json") json = true
    else if (a === "--rules") {
      process.stdout.write(rulesMarkdown(modules))
      return 0
    } else names.push(a.replace(/\/+$/, "").split("/").at(-1))
  }
  const root = path.resolve(rootArg ?? "")
  if (!rootArg || !fs.existsSync(root) || !fs.statSync(root).isDirectory()) {
    process.stderr.write(`specs ルートが見つからない: ${rootArg}\n`)
    return 2
  }
  const all = listSpecNames(root)
  const unknown = names.filter(n => !all.includes(n))
  if (unknown.length > 0) {
    process.stderr.write(`存在しない spec: ${unknown.join(", ")}\n`)
    return 2
  }
  const specs = all.map(n => loadSpec(root, n))
  const targets = new Set(names.length > 0 ? names : all)
  const ctx = { root, repoRoot: path.dirname(root), specs, targets }
  const findings = sortFindings(modules.flatMap(m => m.check(ctx)))
  if (json) {
    process.stdout.write(JSON.stringify(findings, null, 2) + "\n")
  } else {
    for (const f of findings)
      process.stdout.write(`${f.file}:${f.line}: [${f.rule}] ${f.message}\n`)
    process.stdout.write(
      findings.length === 0 ? "指摘なし\n" : `${findings.length} 件の指摘\n`,
    )
  }
  return findings.length === 0 ? 0 : 1
}
