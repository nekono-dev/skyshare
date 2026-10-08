/**
 * 構造チェック: specs 配下のディレクトリ構成と spec 間の独立性を検証する。
 *
 * - specs/<コンポーネント>/ の1階層のみ（階層構造の禁止）
 * - 他 spec への参照は requirements.md の「3. 前提」に限り、連鎖させない
 * - 全タスク完了済みの spec は、記載したパス・テストが実在する（仕様と実装の乖離検出）
 * - 実装がすべて消えた spec（dead spec）を検出する
 */
import fs from "node:fs"
import path from "node:path"
import { pathToFileURL } from "node:url"
import {
  SPEC_FILES,
  finding,
  runCli,
  sectionsByH2,
  splitRow,
  isTableLine,
} from "./lib.mjs"

export const title = "構造チェック（check-structure）"

const MAX_PREREQ = 2

export const rules = {
  S001: "specs 直下にはディレクトリのみを置く（ファイルを置かない）",
  S002: "spec ディレクトリ名は小文字英数字とハイフンのみ（30文字以内）にする",
  S003: "spec ディレクトリには requirements.md・design.md・tasks.md の3ファイルのみを置く（サブディレクトリによる階層化を禁止する）",
  S004: "他 spec への参照（specs/<名>、../<名>/、ハイフンを含む `<名>`）は requirements.md の「3. 前提」以外に書かない",
  S005: `前提の参照先は実在する他 spec とし、${MAX_PREREQ} 件以内、かつ参照先自身は前提を持たない（連鎖・循環の禁止）`,
  S006: "全タスクが完了済み（[x]）の spec では、design.md の構成表のパスが実在する",
  S007: "全タスクが完了済み（[x]）の spec では、tasks.md の検証行・E2E 行に書いたテストファイルが実在する",
  S008: "全タスクが完了済み（[x]）の spec では、すべての受け入れ条件 AC-n について、tests/ 配下のテストコードに「<spec名>/AC-n」を含むテスト（テスト名に付与する）が存在する",
  S009: "全タスクが完了済み（[x]）の spec で構成表のパスがすべて存在しない場合は dead spec とみなし、spec ディレクトリごと削除する",
}

const TEST_PATH_RE =
  /\b((?:tests|src)\/[\w./-]+\.(?:test|spec)\.[cm]?[jt]sx?)\b/g

/** tests/ 配下のテストコードを連結した文字列（S008 用。ctx ごとに1回だけ読む） */
function testCorpus(ctx) {
  if (ctx.testCorpus !== undefined) return ctx.testCorpus
  const texts = []
  const walk = dir => {
    if (!fs.existsSync(dir)) return
    const entries = fs
      .readdirSync(dir, { withFileTypes: true })
      .sort((a, b) => (a.name < b.name ? -1 : 1))
    for (const e of entries) {
      const p = path.join(dir, e.name)
      if (e.isDirectory()) walk(p)
      else if (/\.[cm]?[jt]sx?$/.test(e.name))
        texts.push(fs.readFileSync(p, "utf8"))
    }
  }
  walk(path.join(ctx.repoRoot, "tests"))
  ctx.testCorpus = texts.join("\n")
  return ctx.testCorpus
}

const NAME_RE = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/

const escapeRe = s => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")

/** requirements.md の「3. 前提」から前提 spec 名を取り出す */
function prerequisites(spec) {
  const f = spec.files.requirements
  if (!f) return { lines: new Set(), deps: [] }
  const sec = sectionsByH2(f.lines).find(s => s.title === "3. 前提")
  const lines = new Set()
  const deps = []
  for (const l of sec?.lines ?? []) {
    lines.add(l.no)
    const m = /^- 前提: ([a-z0-9-]+) — /.exec(l.text.trim())
    if (m) deps.push({ name: m[1], no: l.no })
  }
  return { lines, deps }
}

export function check(ctx) {
  const out = []
  const rootRel =
    path.relative(process.cwd(), ctx.root).split(path.sep).join("/") || "."

  // S001: specs 直下のファイル（全体チェックのときのみ）
  if (ctx.targets.size === ctx.specs.length) {
    for (const e of fs
      .readdirSync(ctx.root, { withFileTypes: true })
      .sort((a, b) => (a.name < b.name ? -1 : 1))) {
      if (!e.isDirectory())
        out.push(
          finding(
            `${rootRel}/${e.name}`,
            1,
            "S001",
            "specs 直下にファイルを置かない",
          ),
        )
    }
  }

  const names = ctx.specs.map(s => s.name)
  const prereqOf = new Map(ctx.specs.map(s => [s.name, prerequisites(s)]))

  for (const spec of ctx.specs) {
    if (!ctx.targets.has(spec.name)) continue
    if (!NAME_RE.test(spec.name) || spec.name.length > 30) {
      out.push(
        finding(
          spec.rel,
          1,
          "S002",
          "ディレクトリ名は小文字英数字とハイフンのみ（30文字以内）",
        ),
      )
    }

    // S003: 構成ファイルの過不足・階層
    for (const e of spec.entries) {
      if (e.isDir)
        out.push(
          finding(
            `${spec.rel}/${e.name}`,
            1,
            "S003",
            "サブディレクトリを置かない（階層化の禁止。コンポーネント単位で specs 直下に分ける）",
          ),
        )
      else if (!SPEC_FILES.includes(e.name))
        out.push(
          finding(
            `${spec.rel}/${e.name}`,
            1,
            "S003",
            "3ファイル以外を置かない",
          ),
        )
    }
    for (const f of SPEC_FILES) {
      if (!spec.files[f.replace(/\.md$/, "")])
        out.push(finding(spec.rel, 1, "S003", `${f} がない`))
    }

    // S004: 他 spec への参照
    const { lines: preLines, deps } = prereqOf.get(spec.name)
    const others = names.filter(n => n !== spec.name)
    // ハイフンを含まない名前（timeline 等）はコード上の識別子と区別できないため、
    // バッククォートでの言及はハイフンを含む名前に限って検出する
    const hyphenated = others.filter(n => n.includes("-"))
    const backtickRe =
      hyphenated.length > 0
        ? new RegExp("`(" + hyphenated.map(escapeRe).join("|") + ")`")
        : null
    for (const [kind, f] of Object.entries(spec.files)) {
      for (const l of f.lines) {
        if (kind === "requirements" && preLines.has(l.no)) continue
        const hits = []
        for (const m of l.text.matchAll(/specs\/([a-z0-9_-]+)/g))
          if (m[1] !== spec.name) hits.push(m[0])
        for (const m of l.text.matchAll(/\.\.\/([a-z0-9_-]+)/g))
          if (others.includes(m[1])) hits.push(m[0])
        const b = backtickRe?.exec(l.text)
        if (b) hits.push(b[0])
        for (const h of hits)
          out.push(
            finding(
              f.rel,
              l.no,
              "S004",
              `他 spec への参照「${h}」（前提として必要なら「3. 前提」に書く）`,
            ),
          )
      }
    }

    // S005: 前提の妥当性
    const req = spec.files.requirements
    if (req) {
      if (deps.length > MAX_PREREQ)
        out.push(
          finding(
            req.rel,
            deps[MAX_PREREQ].no,
            "S005",
            `前提は ${MAX_PREREQ} 件以内`,
          ),
        )
      for (const d of deps) {
        if (d.name === spec.name)
          out.push(finding(req.rel, d.no, "S005", "自身を前提にしない"))
        else if (!names.includes(d.name))
          out.push(
            finding(req.rel, d.no, "S005", `前提 ${d.name} が存在しない`),
          )
        else if (prereqOf.get(d.name).deps.length > 0) {
          out.push(
            finding(
              req.rel,
              d.no,
              "S005",
              `前提 ${d.name} 自身が前提（${prereqOf
                .get(d.name)
                .deps.map(x => x.name)
                .join(", ")}）を持つ（連鎖の禁止）`,
            ),
          )
        }
      }
    }

    // S006〜S009: 全タスク完了済み spec の実装との整合
    const tasks = spec.files.tasks
    if (!tasks) continue
    const boxes = tasks.lines.filter(l => /^- \[[ x]\] /.test(l.text))
    const done =
      boxes.length > 0 && boxes.every(l => l.text.startsWith("- [x]"))
    if (!done) continue
    const exists = p => fs.existsSync(path.join(ctx.repoRoot, p))

    // S006/S009: 構成表のパス。すべて不在なら dead spec として削除を求める
    const design = spec.files.design
    const comp =
      design && sectionsByH2(design.lines).find(s => s.title === "1. 構成")
    const compPaths = []
    for (const l of (comp?.lines ?? []).filter(isTableLine).slice(2)) {
      const m = /^`([^`]+)`$/.exec(splitRow(l.text)[0])
      if (m && !/[*<>]/.test(m[1])) compPaths.push({ p: m[1], no: l.no })
    }
    const missing = compPaths.filter(c => !exists(c.p))
    if (compPaths.length > 0 && missing.length === compPaths.length) {
      out.push(
        finding(
          spec.rel,
          1,
          "S009",
          "構成表のパスがすべて存在しない（dead spec。spec ディレクトリごと削除する）",
        ),
      )
    } else {
      for (const c of missing)
        out.push(
          finding(design.rel, c.no, "S006", `構成表のパス ${c.p} が存在しない`),
        )
    }

    // S007: 検証行・E2E 行のテストファイル
    for (const l of tasks.lines.filter(x => /^- (検証|E2E): /.test(x.text))) {
      for (const m of l.text.matchAll(TEST_PATH_RE)) {
        if (!exists(m[1]))
          out.push(
            finding(
              tasks.rel,
              l.no,
              "S007",
              `テストファイル ${m[1]} が存在しない`,
            ),
          )
      }
    }

    // S008: 受け入れ条件のテスト対応（テストコード中に <spec名>/AC-n が現れる）
    const req2 = spec.files.requirements
    const corpus = testCorpus(ctx)
    for (const l of req2?.lines ?? []) {
      const m = /^- (AC-\d+) /.exec(l.text)
      if (!m) continue
      const tag = `${spec.name}/${m[1]}`
      if (!new RegExp(escapeRe(tag) + "(?!\\d)").test(corpus))
        out.push(
          finding(
            req2.rel,
            l.no,
            "S008",
            `テストコード（tests/）に「${tag}」を含むテストがない`,
          ),
        )
    }
  }
  return out
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = runCli([{ title, rules, check }])
}
