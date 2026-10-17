/**
 * 仕様書チェックスクリプト群の共通処理。
 *
 * - Markdown を行単位に分解し、コードブロック内かどうかを付与する。
 * - specs ルート配下の各 spec ディレクトリを読み込む。
 * - 指摘（finding）を決定的な順序で整列・出力する CLI を提供する。
 *
 * この共通処理自体は外部依存を持たない。Mermaid の構文検証だけが scripts/package.json の
 * 依存を使う（mermaid-syntax.mjs）。同じ入力に対して常に同じ出力を返す（冪等）。
 */
import fs from "node:fs"
import path from "node:path"

export const SPEC_FILES = ["requirements.md", "design.md", "tasks.md"]

/** 検査に必要な依存が導入されていないことを表す。CLI は案内を表示して終了コード 1 で止まる */
export class SetupError extends Error {
  name = "SetupError"
}

/** 行配列へ分解する。フェンス行自身もコード扱いにし、コードブロックの言語（なければ ""）を lang に付与する */
export function parseLines(text) {
  let inCode = false
  let lang = ""
  const lines = text.split(/\r?\n/)
  // 末尾の空行は行数に数えない
  while (lines.length > 0 && lines.at(-1).trim() === "") lines.pop()
  return lines.map((raw, i) => {
    const m = /^\s*```\s*(\S*)/.exec(raw)
    if (m) {
      if (!inCode) lang = m[1]
      inCode = !inCode
      const fenceLang = lang
      if (!inCode) lang = ""
      return { no: i + 1, text: raw, code: true, fence: true, lang: fenceLang }
    }
    return {
      no: i + 1,
      text: raw,
      code: inCode,
      fence: false,
      lang: inCode ? lang : "",
    }
  })
}

/** コードブロック単位に分解する。lines は本文のみ（フェンス行を含まない） */
export function codeBlocks(lines) {
  const out = []
  let cur = null
  for (const l of lines) {
    if (l.fence) {
      if (cur === null) cur = { lang: l.lang, open: l, lines: [], close: null }
      else {
        cur.close = l
        out.push(cur)
        cur = null
      }
    } else if (cur) cur.lines.push(l)
  }
  if (cur) out.push(cur)
  return out
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

export const nonBlank = (lines) => lines.filter((l) => l.text.trim() !== "")

export const isTableLine = (l) => !l.code && /^\s*\|/.test(l.text)

export const splitRow = (text) =>
  text
    .trim()
    .replace(/^\||\|$/g, "")
    .split("|")
    .map((s) => s.trim())

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

const toPosix = (p) => p.split(path.sep).join("/")

export function listSpecNames(root) {
  return fs
    .readdirSync(root, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort()
}

export function loadSpec(root, name) {
  const dir = path.join(root, name)
  const entries = fs
    .readdirSync(dir, { withFileTypes: true })
    .map((e) => ({ name: e.name, isDir: e.isDirectory() }))
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
    .filter((f) => {
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
      out.push(`| ${id} | ${desc.replaceAll("|", "\\|")} |`)
  }
  return out.join("\n") + "\n"
}

// ---------------------------------------------------------------------------
// 設定（リポジトリ直下の .spec-driven.json）
// ---------------------------------------------------------------------------

export const CONFIG_FILE = ".spec-driven.json"

/** 設定ファイルの内容が不正であることを表す。CLI は案内を表示して終了コード 2 で止まる */
export class ConfigError extends Error {
  name = "ConfigError"
}

/** 調整できるのは数値のみ。質的なルール（語彙・図の記法・章立て）は設定で変えられない */
const CONFIG_SCHEMA = {
  architecture: {
    minSpecs: { def: 3, min: 1, max: 50 },
    maxLines: { def: 400, min: 200, max: 800 },
    maxFunctionLines: { def: 80, min: 40, max: 150 },
    maxGroupLines: { def: 300, min: 150, max: 600 },
    maxFunctions: { def: 5, min: 1, max: 20 },
    groupMinComponents: { def: 8, min: 2, max: 50 },
    mergeSimilarity: { def: 0.8, min: 0.5, max: 1, float: true },
  },
  poc: {
    maxReadmeLines: { def: 100, min: 50, max: 200 },
    maxPending: { def: 3, min: 1, max: 10 },
  },
}
/** 範囲（[最小, 最大]）を取る設定。architecture 配下に置く */
const RANGES = {
  functionComponents: { def: [2, 6], min: 2, max: 10 },
  groupComponents: { def: [2, 8], min: 1, max: 20 },
  groupCount: { def: [3, 10], min: 2, max: 30 },
}

/** 実効値の設定を返す。ファイルがなければ初期値。未知のキー・範囲外・型違いは ConfigError */
export function loadConfig(repoRoot) {
  const file = path.join(repoRoot, CONFIG_FILE)
  let raw = {}
  if (fs.existsSync(file)) {
    try {
      raw = JSON.parse(fs.readFileSync(file, "utf8"))
    } catch (e) {
      throw new ConfigError(
        `${CONFIG_FILE} を JSON として読めない: ${e.message}`,
      )
    }
    if (raw === null || typeof raw !== "object" || Array.isArray(raw))
      throw new ConfigError(`${CONFIG_FILE} の最上位はオブジェクトにする`)
  }
  const out = {}
  for (const key of Object.keys(raw))
    if (!(key in CONFIG_SCHEMA))
      throw new ConfigError(`${CONFIG_FILE}: 未知のキー「${key}」`)
  for (const [group, items] of Object.entries(CONFIG_SCHEMA)) {
    const given = raw[group] ?? {}
    if (given === null || typeof given !== "object" || Array.isArray(given))
      throw new ConfigError(`${CONFIG_FILE}: ${group} はオブジェクトにする`)
    const known = new Set(Object.keys(items))
    if (group === "architecture")
      for (const k of Object.keys(RANGES)) known.add(k)
    for (const key of Object.keys(given))
      if (!known.has(key))
        throw new ConfigError(`${CONFIG_FILE}: 未知のキー「${group}.${key}」`)
    out[group] = {}
    for (const [key, spec] of Object.entries(items)) {
      const v = given[key] ?? spec.def
      const ok =
        typeof v === "number" &&
        Number.isFinite(v) &&
        (spec.float || Number.isInteger(v)) &&
        v >= spec.min &&
        v <= spec.max
      if (!ok)
        throw new ConfigError(
          `${CONFIG_FILE}: ${group}.${key} は ${spec.float ? "" : "整数 "}${spec.min}〜${spec.max} にする（指定値: ${JSON.stringify(v)}）`,
        )
      out[group][key] = v
    }
  }
  for (const [key, spec] of Object.entries(RANGES)) {
    const v = raw.architecture?.[key] ?? spec.def
    const ok =
      Array.isArray(v) &&
      v.length === 2 &&
      v.every((n) => Number.isInteger(n) && n >= spec.min && n <= spec.max) &&
      v[0] <= v[1]
    if (!ok)
      throw new ConfigError(
        `${CONFIG_FILE}: architecture.${key} は [最小, 最大]（整数 ${spec.min}〜${spec.max}、最小 ≦ 最大）にする（指定値: ${JSON.stringify(v)}）`,
      )
    out.architecture[key] = v
  }
  return out
}

// ---------------------------------------------------------------------------
// spec の状態・architecture・PoC の読み込み
// ---------------------------------------------------------------------------

/** tasks.md のチェックボックスの完了数と総数 */
export function taskProgress(spec) {
  const boxes = (spec.files.tasks?.lines ?? []).filter((l) =>
    /^- \[[ x]\] /.test(l.text),
  )
  return {
    done: boxes.filter((l) => l.text.startsWith("- [x]")).length,
    total: boxes.length,
  }
}

/** 全タスクが完了（[x]）している */
export function isCompleted(spec) {
  const { done, total } = taskProgress(spec)
  return total > 0 && done === total
}

/** 設計済み（design.md がある）spec。要件のみ（requirements.md だけ）の spec は含めない */
export const isDesigned = (spec) => Boolean(spec.files.design)

const readFile = (p) => ({
  rel: toPosix(path.relative(process.cwd(), p)),
  lines: parseLines(fs.readFileSync(p, "utf8")),
})

const byName = (a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0)

/**
 * architecture（docs/architecture.md と docs/architecture/*.md）と PoC（poc/<テーマ>/README.md）を読み込む。
 * 存在しないものは null／空にする（有無の判定は各チェックの責務）。
 */
export function loadDocs(repoRoot) {
  const mainPath = path.join(repoRoot, "docs", "architecture.md")
  const partsDir = path.join(repoRoot, "docs", "architecture")
  const entries = fs.existsSync(partsDir)
    ? fs
        .readdirSync(partsDir, { withFileTypes: true })
        .map((e) => ({ name: e.name, isDir: e.isDirectory() }))
        .sort(byName)
    : []
  const architecture = {
    mainRel: "docs/architecture.md",
    partsRel: "docs/architecture",
    main: fs.existsSync(mainPath) ? readFile(mainPath) : null,
    partEntries: entries,
    parts: entries
      .filter((e) => !e.isDir && e.name.endsWith(".md"))
      .map((e) => ({
        name: e.name.replace(/\.md$/, ""),
        file: readFile(path.join(partsDir, e.name)),
      })),
  }
  const pocDir = path.join(repoRoot, "poc")
  const pocEntries = fs.existsSync(pocDir)
    ? fs
        .readdirSync(pocDir, { withFileTypes: true })
        .map((e) => ({ name: e.name, isDir: e.isDirectory() }))
        .sort(byName)
    : []
  const pocs = pocEntries
    .filter((e) => e.isDir)
    .map((e) => {
      const dir = path.join(pocDir, e.name)
      const readme = path.join(dir, "README.md")
      return {
        name: e.name,
        rel: `poc/${e.name}`,
        dir,
        readme: fs.existsSync(readme) ? readFile(readme) : null,
      }
    })
  return {
    architecture,
    pocs,
    pocFiles: pocEntries.filter((e) => !e.isDir).map((e) => e.name),
  }
}

/** 先頭の表を解析する。ヘッダー・区切り行・データ行を返す（表がなければ null） */
export function parseTable(lines) {
  const rows = nonBlank(lines).filter(isTableLine)
  if (rows.length === 0) return null
  const header = splitRow(rows[0].text)
  const hasSep = rows[1] && /^\s*\|[\s:|-]+\|\s*$/.test(rows[1].text)
  return {
    header,
    headerNo: rows[0].no,
    separator: Boolean(hasSep),
    rows: rows
      .slice(hasSep ? 2 : 1)
      .map((l) => ({ cells: splitRow(l.text), no: l.no })),
  }
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

/** 位置引数を対象の種別へ正規化する（spec 名／architecture／poc/<テーマ>） */
function normalizeTarget(arg) {
  const s = arg.replace(/\/+$/, "")
  if (["architecture", "docs/architecture", "docs/architecture.md"].includes(s))
    return "architecture"
  const m = /^(?:\.\/)?poc\/([^/]+)(?:\/README\.md)?$/.exec(s)
  if (m) return `poc/${m[1]}`
  return s.split("/").at(-1)
}

/**
 * 検査の入力（ctx）を作る。設定が不正なら ConfigError、対象が不正なら Error（message を表示）を投げる。
 */
export function buildContext(rootArg, names, options) {
  const root = path.resolve(rootArg ?? "")
  if (!rootArg || !fs.existsSync(root) || !fs.statSync(root).isDirectory())
    throw new UsageError(`specs ルートが見つからない: ${rootArg}`)
  const repoRoot = path.dirname(root)
  const config = loadConfig(repoRoot)
  const specNames = listSpecNames(root)
  const docs = loadDocs(repoRoot)
  const wanted = names.map(normalizeTarget)
  const pocNames = docs.pocs.map((p) => `poc/${p.name}`)
  const unknown = wanted.filter(
    (n) =>
      n !== "architecture" && !specNames.includes(n) && !pocNames.includes(n),
  )
  if (unknown.length > 0)
    throw new UsageError(`存在しない対象: ${unknown.join(", ")}`)
  const all = wanted.length === 0
  return {
    root,
    repoRoot,
    config,
    specs: specNames.map((n) => loadSpec(root, n)),
    docs,
    // 対象の絞り込み。引数なしは全件。spec 名は targets、architecture／PoC は個別に持つ
    targets: new Set(
      all ? specNames : wanted.filter((n) => specNames.includes(n)),
    ),
    targetArch: all || wanted.includes("architecture"),
    targetPocs: new Set(
      all ? pocNames : wanted.filter((n) => pocNames.includes(n)),
    ),
    options,
  }
}

/** 引数の誤りを表す。CLI は終了コード 2 で止まる */
export class UsageError extends Error {
  name = "UsageError"
}

/**
 * CLI 本体。
 * 使い方: <script> [--root specs] [--json] [--rules] [--no-syntax] [対象...]
 *   対象: spec 名／architecture／poc/<テーマ>（省略時は全件）
 *   --show-config                  実効値の設定を JSON で表示する
 *   --status                       工程の導出（成果物から。宣言は持たない。常に終了コード 0）
 *   --retarget-poc <テーマ> [--write]  architecture の根拠を PoC の反映先 spec へ付け替える（既定は差分の表示のみ）
 *   --check-poc-committed <テーマ>  PoC の削除前確認（read-only。0=削除可 / 1=未コミットあり / 2=追跡外）
 * --no-syntax は Mermaid の構文検証（G014）を省く。selftest 専用で、lint:spec や CI では使わない。
 * 終了コード: 0=指摘なし / 1=指摘あり・依存の未導入 / 2=引数エラー・設定エラー
 */
export async function runCli(modules, argv = process.argv.slice(2)) {
  let rootArg = "specs"
  let json = false
  let syntax = true
  let command = null
  let write = false
  const names = []
  const needValue = new Set([
    "--root",
    "--retarget-poc",
    "--check-poc-committed",
  ])
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (
      needValue.has(a) &&
      (argv[i + 1] === undefined || argv[i + 1].startsWith("--"))
    ) {
      process.stderr.write(`${a} には値が必要\n`)
      return 2
    }
    if (a === "--root") rootArg = argv[++i]
    else if (a === "--json") json = true
    else if (a === "--no-syntax") syntax = false
    else if (a === "--write") write = true
    else if (a === "--status") command = { name: "status" }
    else if (a === "--show-config") command = { name: "showConfig" }
    else if (a === "--retarget-poc")
      command = { name: "retarget", theme: argv[++i] }
    else if (a === "--check-poc-committed")
      command = { name: "checkCommitted", theme: argv[++i] }
    else if (a === "--rules") {
      process.stdout.write(rulesMarkdown(modules))
      return 0
    } else names.push(a)
  }
  let ctx
  try {
    ctx = buildContext(rootArg, names, { syntax })
  } catch (e) {
    if (!(e instanceof UsageError || e instanceof ConfigError)) throw e
    process.stderr.write(e.message + "\n")
    return 2
  }
  if (command) {
    const { runCommand } = await import("./commands.mjs")
    return runCommand(command, ctx, { json, write })
  }
  let findings
  try {
    const results = []
    for (const m of modules) results.push(await m.check(ctx))
    findings = sortFindings(results.flat())
  } catch (e) {
    if (!(e instanceof SetupError)) throw e
    process.stderr.write(e.message + "\n")
    return 1
  }
  if (!syntax)
    process.stderr.write("Mermaid の構文検証（G014）を省いた（--no-syntax）\n")
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
