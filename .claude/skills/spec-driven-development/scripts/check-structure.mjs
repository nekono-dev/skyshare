/**
 * 構造チェック: specs 配下のディレクトリ構成と spec 間の独立性を検証する。
 *
 * - specs/<コンポーネント>/ の1階層のみ（階層構造の禁止）
 * - 他 spec への参照は requirements.md の「3. 前提」に限り、連鎖させない
 * - 全タスク完了済みの spec は、記載したパス・テストが実在する（仕様と実装の乖離検出）
 * - 実装がすべて消えた spec（dead spec）を検出する
 * - architecture（docs/architecture.md と、機能のくくりの文書 docs/architecture/*.md）と spec・PoC の突合、
 *   全体とくくりの文書の整合、PoC の配置・滞留・残留を検出する
 */
import fs from "node:fs"
import path from "node:path"
import { pathToFileURL } from "node:url"
import {
  SPEC_FILES,
  finding,
  isCompleted,
  isDesigned,
  runCli,
  sectionsByH2,
  splitRow,
  isTableLine,
} from "./lib.mjs"
import {
  parseArchitecture,
  parsePoc,
  pocState,
  pocThemeOf,
  isPending,
} from "./docs-model.mjs"

export const title = "構造チェック（check-structure）"

const MAX_PREREQ = 2

export const rules = {
  S001: "specs 直下にはディレクトリのみを置く（ファイルを置かない）",
  S002: "spec ディレクトリ名は小文字英数字とハイフンのみ（30文字以内）にする",
  S003: "spec ディレクトリには requirements.md・design.md・tasks.md の3ファイルのみを置く（サブディレクトリによる階層化を禁止する）。requirements.md は必須で、design.md と tasks.md は両方置くか両方置かない（両方なしは「要件のみ」の spec）",
  S004: "他 spec への参照（specs/<名>、../<名>/、ハイフンを含む `<名>`）は requirements.md の「3. 前提」以外に書かない",
  S005: `前提の参照先は実在する他 spec とし、${MAX_PREREQ} 件以内、かつ参照先自身は前提を持たない（連鎖・循環の禁止）`,
  S006: "全タスクが完了済み（[x]）の spec では、design.md の構成表のパスが実在する",
  S007: "全タスクが完了済み（[x]）の spec では、tasks.md の検証行・E2E 行に書いたテストファイルが実在する",
  S008: "全タスクが完了済み（[x]）の spec では、すべての受け入れ条件 AC-n について、tests/ 配下のテストコードに「<spec名>/AC-n」を含むテスト（テスト名に付与する）が存在する",
  S009: "全タスクが完了済み（[x]）の spec で構成表のパスがすべて存在しない場合は dead spec とみなし、spec ディレクトリごと削除する",
  S010: "設計済み（design.md がある）spec の数が設定の閾値（architecture.minSpecs。初期 3）以上なら docs/architecture.md を置く",
  S011: "docs/architecture/ には、機能のくくりの文書（小文字英数字とハイフンのみ・30文字以内の .md）だけを置く。くくりの文書は docs/architecture.md の「2. 構成要素」の内部の行（詳細列）からちょうど1回リンクされ、リンク先は実在し、1行目の H1 は「# <くくり名> アーキテクチャ」とする",
  S012: "実装spec の集合（docs/architecture.md の構成要素表。くくり別に分けたときは各くくりの文書の内部の行）が、設計済み spec の集合と一致する（漏れ・重複・実在しない名前・要件のみの spec を置かない）",
  S013: "architecture の根拠に書いた spec 名（設計済みの spec）と poc/<テーマ>（README.md のある PoC）が実在する",
  S014: "poc/ 直下にはテーマのディレクトリ（小文字英数字とハイフンのみ・30文字以内）だけを置き、各テーマに README.md を置く",
  S015: "PoC の反映先に書いた spec は設計済みの spec として実在する",
  S016: "反映先 spec の全タスクが完了（[x]）した PoC は削除する。削除の前に --check-poc-committed で履歴に入っていることを確認する",
  S017: "反映済みでない（検証中・反映待ちの）PoC の件数が設定の上限（poc.maxPending。初期 3）以内である",
  S018: "反映先 spec の全タスクが完了した PoC を、architecture の根拠に残さない（--retarget-poc で反映先 spec へ付け替える）",
  S019: "内部の構成要素の数が設定の閾値（architecture.groupMinComponents。初期 8）以上なら、機能のくくりの文書に分ける（全体の構成要素表の最終列を詳細にする）。閾値未満なら分けない（docs/architecture/ を置かない）",
  S020: "くくり別に分けたとき、内部の構成要素の名前はくくりの文書の間で重複しない。「他機能」の行の名前は、別のくくりの文書の内部の要素にちょうど1つ実在する",
  S021: "くくり別に分けたとき、くくりの文書の外部の要素は全体の構成要素表の外部に実在し、全体の外部の要素はいずれかのくくりの文書に現れる。全体の外部インターフェース表の行（IF・方向・外部の要素・内部の要素）は、くくりの文書の外部インターフェース表の行（内部の要素は属するくくり名に置き換える）の集合と一致する",
  S022: "くくり別に分けたとき、信頼と検証・技術基盤・横断的制約の根拠の spec は、くくりの文書では自くくりの実装spec に限り、全体では2つ以上のくくりにまたがる行に限る（poc/<テーマ> だけの行はどちらにも置ける）",
}

const TEST_PATH_RE =
  /\b((?:tests|src)\/[\w./-]+\.(?:test|spec)\.[cm]?[jt]sx?)\b/g

/** tests/ 配下のテストコードを連結した文字列（S008 用。ctx ごとに1回だけ読む） */
function testCorpus(ctx) {
  if (ctx.testCorpus !== undefined) return ctx.testCorpus
  const texts = []
  const walk = (dir) => {
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

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")

/** requirements.md の「3. 前提」から前提 spec 名を取り出す */
function prerequisites(spec) {
  const f = spec.files.requirements
  if (!f) return { lines: new Set(), deps: [] }
  const sec = sectionsByH2(f.lines).find((s) => s.title === "3. 前提")
  const lines = new Set()
  const deps = []
  for (const l of sec?.lines ?? []) {
    lines.add(l.no)
    const m = /^- 前提: ([a-z0-9-]+) — /.exec(l.text.trim())
    if (m) deps.push({ name: m[1], no: l.no })
  }
  return { lines, deps }
}

const KEBAB_RE = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/

/** --status が使う、architecture と spec・PoC の突合の指摘（対象の絞り込みを無視する） */
export const crossFindings = (ctx) => archFindings(ctx)

/** S010〜S013・S018〜S022: architecture の有無と、spec・PoC・文書間の突合 */
function archFindings(ctx) {
  const out = []
  const arch = ctx.docs.architecture
  const designed = ctx.specs.filter(isDesigned)
  const designedNames = new Set(designed.map((s) => s.name))
  const { minSpecs, groupMinComponents } = ctx.config.architecture

  if (!arch.main) {
    if (designed.length >= minSpecs)
      out.push(
        finding(
          arch.mainRel,
          1,
          "S010",
          `設計済みの spec が ${designed.length} 件（閾値 ${minSpecs} 件以上）のため ${arch.mainRel} が必要`,
        ),
      )
  }

  // S011: くくりの文書の配置
  for (const e of arch.partEntries) {
    const rel = `${arch.partsRel}/${e.name}`
    if (e.isDir)
      out.push(
        finding(
          rel,
          1,
          "S011",
          "docs/architecture/ にサブディレクトリを置かない",
        ),
      )
    else if (!e.name.endsWith(".md"))
      out.push(
        finding(
          rel,
          1,
          "S011",
          "docs/architecture/ には .md のくくりの文書だけを置く",
        ),
      )
    else {
      const base = e.name.replace(/\.md$/, "")
      if (!KEBAB_RE.test(base) || base.length > 30)
        out.push(
          finding(
            rel,
            1,
            "S011",
            "くくりの文書のファイル名は小文字英数字とハイフンのみ（30文字以内）",
          ),
        )
    }
  }
  if (!arch.main) {
    if (arch.parts.length > 0)
      out.push(
        finding(arch.partsRel, 1, "S011", `全体（${arch.mainRel}）がない`),
      )
    return out
  }
  const parsed = parseArchitecture(arch)
  const grouped = parsed.mode === "grouped"
  const main = parsed.main
  const sec2 = main.sec("2. 構成要素")

  if (parsed.mode === "legacy")
    out.push(
      finding(
        arch.partsRel,
        1,
        "S011",
        `docs/architecture/ に ${arch.partEntries.length} 件のファイルがあるが、全体の構成要素表の最終列が「詳細」でない（機能ごとの旧形式、または移行の途中）。構成要素をくくりにまとめて作り直す（references/workflow.md の 10 節）。1 ファイルにするなら docs/architecture/ を削除する`,
      ),
    )

  // S011: 全体からのリンクと H1
  if (grouped) {
    const partNames = new Set(arch.parts.map((p) => p.name))
    const linked = new Map()
    for (const c of main.components) {
      if (c.kind !== "内部" || !c.link) continue
      const base = c.link.target.replace(/\.md$/, "")
      if (!partNames.has(base))
        out.push(
          finding(
            arch.main.rel,
            c.no,
            "S011",
            `詳細のリンク先 ${arch.partsRel}/${c.link.target} が存在しない`,
          ),
        )
      linked.set(base, (linked.get(base) ?? 0) + 1)
      if (linked.get(base) > 1)
        out.push(
          finding(
            arch.main.rel,
            c.no,
            "S011",
            `${c.link.target} が複数の行からリンクされている`,
          ),
        )
    }
    for (const g of parsed.groups) {
      if (!linked.has(g.file)) {
        out.push(
          finding(
            g.model.file.rel,
            1,
            "S011",
            "くくりの文書が「2. 構成要素」の内部の行（詳細列）からリンクされていない",
          ),
        )
        continue
      }
      if (g.model.file.lines[0]?.text !== `# ${g.name} アーキテクチャ`)
        out.push(
          finding(
            g.model.file.rel,
            1,
            "S011",
            `1行目を「# ${g.name} アーキテクチャ」にする（全体の構成要素表のくくり名）`,
          ),
        )
    }
  }

  // S019: くくり別に分けるか否か
  const n = parsed.internalCount
  if (!grouped && n >= groupMinComponents)
    out.push(
      finding(
        arch.main.rel,
        sec2?.no ?? 1,
        "S019",
        `内部の構成要素が ${n} 個（閾値 ${groupMinComponents} 個以上）のため、機能のくくりの文書に分ける`,
      ),
    )
  if (grouped && n < groupMinComponents)
    out.push(
      finding(
        arch.main.rel,
        sec2?.no ?? 1,
        "S019",
        `内部の構成要素が ${n} 個（閾値 ${groupMinComponents} 個未満）のため、くくり別に分けず 1 ファイルにする`,
      ),
    )

  // S012: 実装spec と設計済み spec の一致
  const listed = new Map()
  for (const doc of grouped ? parsed.groups.map((g) => g.model) : [main])
    for (const c of doc.components)
      for (const name of c.specs) {
        if (listed.has(name))
          out.push(
            finding(
              doc.file.rel,
              c.no,
              "S012",
              `実装spec「${name}」が複数の構成要素に現れる（初出: ${listed.get(name)}）`,
            ),
          )
        else listed.set(name, `${doc.file.rel}:${c.no}`)
        if (!designedNames.has(name)) {
          const exists = ctx.specs.some((s) => s.name === name)
          out.push(
            finding(
              doc.file.rel,
              c.no,
              "S012",
              exists
                ? `実装spec「${name}」は要件のみの spec のため載せない`
                : `実装spec「${name}」が specs/ に存在しない`,
            ),
          )
        }
      }
  for (const name of [...designedNames].sort())
    if (!listed.has(name))
      out.push(
        finding(
          arch.main.rel,
          sec2?.no ?? 1,
          "S012",
          `設計済みの spec「${name}」が${grouped ? "くくりの文書の" : "構成要素表の"}実装spec にない`,
        ),
      )

  // S020〜S022: 全体とくくりの文書の整合
  if (grouped) groupFindings(parsed, out)

  // S013・S018: 根拠の実在と、完了した PoC の残留
  const pocByName = new Map(ctx.docs.pocs.map((p) => [p.name, p]))
  for (const doc of parsed.docs)
    for (const row of doc.basis)
      for (const ref of row.refs) {
        const theme = pocThemeOf(ref)
        if (theme !== null) {
          const poc = pocByName.get(theme)
          if (!poc || !poc.readme) {
            out.push(
              finding(
                doc.file.rel,
                row.no,
                "S013",
                `根拠 ${ref} が存在しない（完了した PoC を削除したなら反映先 spec へ付け替える）`,
              ),
            )
          } else if (pocState(poc, ctx.specs).remove) {
            out.push(
              finding(
                doc.file.rel,
                row.no,
                "S018",
                `根拠 ${ref} の反映先 spec が完了している（--retarget-poc ${theme} で付け替える）`,
              ),
            )
          }
        } else if (
          /^[a-z0-9][a-z0-9-]*$/.test(ref) &&
          !designedNames.has(ref)
        ) {
          out.push(
            finding(
              doc.file.rel,
              row.no,
              "S013",
              `根拠 ${ref} が設計済みの spec として存在しない`,
            ),
          )
        }
      }
  return out
}

/** S020〜S022: くくり別に分けたときの、全体とくくりの文書の整合 */
function groupFindings(parsed, out) {
  const root = parsed.main
  const groups = parsed.groups.filter((g) => g.name)
  const add = (file, no, rule, msg) =>
    out.push(finding(file.rel, no, rule, msg))
  const internal = (m) => m.components.filter((c) => c.kind === "内部")

  // S020: 内部の要素の名前の一意性と、他機能の実在
  const owners = new Map()
  for (const g of groups)
    for (const c of internal(g.model)) {
      const list = owners.get(c.name) ?? []
      list.push(g)
      owners.set(c.name, list)
      if (list.length > 1)
        add(
          g.model.file,
          c.no,
          "S020",
          `内部の要素「${c.name}」が複数のくくりの文書にある（初出: ${list[0].model.file.rel}）`,
        )
    }
  for (const g of groups)
    for (const c of g.model.components) {
      if (c.kind !== "他機能") continue
      const own = (owners.get(c.name) ?? []).filter((x) => x !== g)
      if (own.length !== 1)
        add(
          g.model.file,
          c.no,
          "S020",
          own.length === 0
            ? `他機能の要素「${c.name}」が、別のくくりの文書の内部の要素にない`
            : `他機能の要素「${c.name}」が複数のくくりの文書にある`,
        )
    }

  // S021: 外部の要素と外部インターフェース
  const rootExt = new Map(
    root.components.filter((c) => c.kind === "外部").map((c) => [c.name, c]),
  )
  const usedExt = new Set()
  for (const g of groups)
    for (const c of g.model.components) {
      if (c.kind !== "外部") continue
      usedExt.add(c.name)
      if (!rootExt.has(c.name))
        add(
          g.model.file,
          c.no,
          "S021",
          `外部の要素「${c.name}」が全体の構成要素表の外部にない`,
        )
    }
  for (const [name, c] of rootExt)
    if (!usedExt.has(name))
      add(
        root.file,
        c.no,
        "S021",
        `外部の要素「${name}」がどのくくりの文書にも現れない`,
      )
  const key = (i, int) => `${i.name} | ${i.dir} | ${i.ext} | ${int}`
  const groupIf = new Map()
  for (const g of groups)
    for (const i of g.model.interfaces) {
      const k = key(i, g.name)
      if ([...groupIf.values()].some((x) => x.name === i.name))
        add(
          g.model.file,
          i.no,
          "S021",
          `IF「${i.name}」が複数のくくりの文書にある`,
        )
      groupIf.set(k, { name: i.name, file: g.model.file, no: i.no })
    }
  const rootIf = new Map(root.interfaces.map((i) => [key(i, i.int), i]))
  for (const [k, v] of groupIf)
    if (!rootIf.has(k))
      add(
        v.file,
        v.no,
        "S021",
        `IF「${v.name}」が全体の外部インターフェース表にない（IF・方向・外部の要素・くくり名が一致する行が必要）`,
      )
  for (const [k, i] of rootIf)
    if (!groupIf.has(k))
      add(
        root.file,
        i.no,
        "S021",
        `全体の IF「${i.name}」に対応する行が、くくりの文書の外部インターフェース表にない`,
      )

  // S022: 根拠の置き場所
  const specOwner = new Map()
  for (const g of groups)
    for (const c of g.model.components)
      for (const name of c.specs) specOwner.set(name, g.name)
  const specRefs = (row) =>
    row.refs.filter((r) => pocThemeOf(r) === null && specOwner.has(r))
  for (const g of groups)
    for (const row of g.model.basis)
      for (const ref of specRefs(row))
        if (specOwner.get(ref) !== g.name)
          add(
            g.model.file,
            row.no,
            "S022",
            `根拠 ${ref} は別のくくり「${specOwner.get(ref)}」の spec のため、複数のくくりにまたがる行は全体に置く`,
          )
  for (const row of root.basis) {
    const refs = specRefs(row)
    const owned = new Set(refs.map((r) => specOwner.get(r)))
    if (refs.length > 0 && owned.size < 2)
      add(
        root.file,
        row.no,
        "S022",
        `根拠の spec が 1 つのくくり（${[...owned][0]}）だけのため、その行はくくりの文書に置く`,
      )
  }
}

/** S014〜S017: PoC の配置・反映先・残留・滞留 */
function pocFindings(ctx) {
  const out = []
  const docs = ctx.docs
  const designedNames = new Set(ctx.specs.filter(isDesigned).map((s) => s.name))
  const allPocs = docs.pocs.length === ctx.targetPocs.size
  if (allPocs)
    for (const f of docs.pocFiles)
      out.push(
        finding(
          `poc/${f}`,
          1,
          "S014",
          "poc/ 直下にファイルを置かない（テーマのディレクトリだけを置く）",
        ),
      )
  let pending = 0
  for (const poc of docs.pocs) {
    const target = ctx.targetPocs.has(`poc/${poc.name}`)
    const st = poc.readme ? pocState(poc, ctx.specs) : null
    if (st && isPending(st)) pending++
    if (!target) continue
    if (!KEBAB_RE.test(poc.name) || poc.name.length > 30)
      out.push(
        finding(
          poc.rel,
          1,
          "S014",
          "テーマ名は小文字英数字とハイフンのみ（30文字以内）",
        ),
      )
    if (!poc.readme) {
      out.push(finding(poc.rel, 1, "S014", "README.md がない"))
      continue
    }
    const m = parsePoc(poc)
    if (m.target.name && !designedNames.has(m.target.name))
      out.push(
        finding(
          poc.readme.rel,
          m.target.no,
          "S015",
          `反映先 ${m.target.name} が設計済みの spec として存在しない`,
        ),
      )
    if (st.remove)
      out.push(
        finding(
          poc.readme.rel,
          m.target.no,
          "S016",
          `反映先 ${m.target.name} の全タスクが完了している。履歴を確認して（--check-poc-committed ${poc.name}）削除する`,
        ),
      )
  }
  const { maxPending } = ctx.config.poc
  if (allPocs && pending > maxPending)
    out.push(
      finding(
        "poc",
        1,
        "S017",
        `反映済みでない PoC が ${pending} 件（上限 ${maxPending} 件）`,
      ),
    )
  return out
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

  const names = ctx.specs.map((s) => s.name)
  const prereqOf = new Map(ctx.specs.map((s) => [s.name, prerequisites(s)]))

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
    if (!spec.files.requirements)
      out.push(finding(spec.rel, 1, "S003", "requirements.md がない"))
    if (Boolean(spec.files.design) !== Boolean(spec.files.tasks)) {
      const lacking = spec.files.design ? "tasks.md" : "design.md"
      out.push(
        finding(
          spec.rel,
          1,
          "S003",
          `${lacking} がない（design.md と tasks.md は両方置く。要件のみの spec は両方とも置かない）`,
        ),
      )
    }

    // S004: 他 spec への参照
    const { lines: preLines, deps } = prereqOf.get(spec.name)
    const others = names.filter((n) => n !== spec.name)
    // ハイフンを含まない名前（timeline 等）はコード上の識別子と区別できないため、
    // バッククォートでの言及はハイフンを含む名前に限って検出する
    const hyphenated = others.filter((n) => n.includes("-"))
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
                .deps.map((x) => x.name)
                .join(", ")}）を持つ（連鎖の禁止）`,
            ),
          )
        }
      }
    }

    // S006〜S009: 全タスク完了済み spec の実装との整合
    const tasks = spec.files.tasks
    if (!tasks) continue
    if (!isCompleted(spec)) continue
    const exists = (p) => fs.existsSync(path.join(ctx.repoRoot, p))

    // S006/S009: 構成表のパス。すべて不在なら dead spec として削除を求める
    const design = spec.files.design
    const comp =
      design && sectionsByH2(design.lines).find((s) => s.title === "1. 構成")
    const compPaths = []
    for (const l of (comp?.lines ?? []).filter(isTableLine).slice(2)) {
      const m = /^`([^`]+)`$/.exec(splitRow(l.text)[0])
      if (m && !/[*<>]/.test(m[1])) compPaths.push({ p: m[1], no: l.no })
    }
    const missing = compPaths.filter((c) => !exists(c.p))
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
    for (const l of tasks.lines.filter((x) => /^- (検証|E2E): /.test(x.text))) {
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
  if (ctx.targetArch) out.push(...archFindings(ctx))
  out.push(...pocFindings(ctx))
  return out
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = await runCli([{ title, rules, check }])
}
