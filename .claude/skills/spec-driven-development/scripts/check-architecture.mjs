/**
 * architecture 体裁チェック: docs/architecture.md（と、機能のくくりの文書 docs/architecture/*.md）が雛形どおりであることを検証する。
 *
 * - 章立て・表の列・固定形（機能は「関与 → 説明 → ワークフロー図」）
 * - 表と図の対応（構成要素・外部インターフェース・機能の関与）
 * - 行数の上限、機能の重複・実質・数
 * - 全体（root）の関係図と、くくりの文書の「他機能」から導いた依存の一致
 * 図の記法・規模・状態図・構文の検査は check-diagram の共通処理（G 系）を使う。
 * spec・PoC・文書間の突合は check-structure（S 系）、語彙と文体は check-wording（W 系）が担う。
 */
import { pathToFileURL } from "node:url"
import { syntaxError } from "./mermaid-syntax.mjs"
import {
  analyzeDiagram,
  checkCycle,
  hasBranch,
  splitChapter,
} from "./check-diagram.mjs"
import {
  ARCH_CHAPTERS,
  COMPONENT_KINDS,
  archTables,
  parseArchitecture,
  pocThemeOf,
} from "./docs-model.mjs"
import {
  finding,
  headings,
  isTableLine,
  nonBlank,
  parseTable,
  runCli,
} from "./lib.mjs"

export const title = "architecture 体裁チェック（check-architecture）"

const LIMIT = {
  purposeChars: 300,
  cell: 60,
  name: 30,
}

const len = (s) => [...s].length

export const rules = {
  "F-A01":
    "architecture の文書（docs/architecture.md とくくりの文書）の1行目は「# <名称> アーキテクチャ」の H1 とし、H1 は1つだけにする",
  "F-A02": `architecture の文書の H2 は「${ARCH_CHAPTERS.join("」「")}」をこの順で過不足なく置き、H1 と最初の H2 の間に本文を置かない`,
  "F-A03": "H3 は「5. 機能」の機能見出しだけに使う。H4 以下は使わない",
  "F-A04": `目的と範囲は、箇条書き・表を使わず、合計 ${LIMIT.purposeChars} 文字以内の地の文で書く`,
  "F-A05":
    "表の章（2・4・6・7・8・9）は所定の列見出しの表だけで書く（該当なしは「- なし」。2 章は不可）。全セルを埋め、各セルは 60 文字以内で「。」を含めない。全体（くくり別に分けたとき）の 2 章は最終列を詳細、4 章は方式と認証を除いた 4 列にする",
  "F-A06": `構成要素表: 構成要素名は一意で ${LIMIT.name} 文字以内、種別は「内部」「外部」（くくりの文書は「他機能」も可）。内部は実装spec を1件以上、外部と他機能は実装spec を「-」にする。内部を1件以上置く。全体（くくり別に分けたとき）の内部は機能のくくりで、詳細に「[<くくり名>](architecture/<ファイル>.md)」を書き、外部の詳細は「-」にする`,
  "F-A07":
    "外部インターフェース表: IF 名は一意、方向は「提供」「利用」、外部の要素は構成要素表の外部、内部の要素は構成要素表の内部とし、すべての外部の要素がいずれかの IF に現れる",
  "F-A08":
    "システム構成（3章）は内部の要素だけの関係図（flowchart／classDiagram）1〜3 個で書く（内部が1件以下なら「- なし」）。ノード名は構成要素表の内部の名前と一致し、すべての内部の要素がいずれかの図に現れる。くくりの文書は他機能の要素も置け、置いた他機能はすべていずれかの図に現れ、他機能どうしを辺で結ばない",
  "F-A09":
    "外部インターフェース（4章）の表の後に境界図（flowchart）を1個だけ置く。ノードは構成要素表の内部と外部の名前（外部は ID を ext_ で始める。他機能は置かない）、辺の名前は IF 名とし、表の行と図の辺が一対一に対応し、向きが方向と一致する（提供 = 外部 → 内部、利用 = 内部 → 外部）",
  "F-A10":
    "機能は「- 関与: 要素, 要素」の行 → 説明1行 → ワークフロー図（sequenceDiagram／stateDiagram-v2）1個の固定形で書き、5 章には機能（H3）だけを置く（なしは「- なし」）。機能名は一意で 30 文字以内",
  "F-A11":
    "機能の関与は構成要素表に実在する名前を重複なく設定値の範囲（初期 2〜6 件）で書く。シーケンス図の参加者は関与と一致し、ノード名は構成要素表の名前（外部は ID を ext_ で始める）にする",
  "F-A12":
    "信頼と検証・技術基盤・横断的制約の根拠は、spec 名または poc/<テーマ> を「、」か「,」で区切って1件以上書く。横断的制約の値は数値を含む",
  "F-A13":
    "docs/architecture.md は設定の行数（architecture.maxLines。初期 400）以内、くくりの文書は設定の行数（architecture.maxGroupLines。初期 300）以内、機能（H3）は設定の行数（architecture.maxFunctionLines。初期 80）以内にする",
  "F-A14":
    "関与する構成要素の集合と、図のメッセージ名の集合が、どちらも設定の類似度（architecture.mergeSimilarity。初期 0.8）以上の機能を同じ文書に2つ以上置かない（同じ振る舞いを重複して書かず、統合する）",
  "F-A17":
    "機能は、外部の要素を関与に1件以上含むか、外部以外の要素を3件以上関与に含める（2つの内部の要素だけの呼び出しは、その要素の spec の設計書に書く）",
  "F-A18":
    "1つの文書に置く機能は、設定の件数（architecture.maxFunctions。初期 5）以内にする",
  "F-A19":
    "くくり別に分けたとき、全体の機能のくくり（内部の行）の数は設定の範囲（architecture.groupCount。初期 3〜10）、くくりの文書の内部の要素の数は設定の範囲（architecture.groupComponents。初期 2〜8）に収める",
  "F-A20":
    "全体の関係図（3章）の辺は、くくりの文書の関係図で他機能の要素と自くくりの要素を結ぶ辺から導いた、くくり間の依存（A → B は A が B に依存）と過不足なく一致する",
}

const NONE = /^- なし$/

/** 章の本文のうち、表の行を除いた行 */
const nonTable = (lines) => lines.filter((l) => !isTableLine(l))

export async function check(ctx) {
  if (!ctx.targetArch) return []
  const parsed = parseArchitecture(ctx.docs.architecture)
  if (!parsed) return []
  const cfg = ctx.config.architecture
  const syntax =
    ctx.options?.syntax === false
      ? null
      : (block) => syntaxError(block.lines, block.open.no)
  const out = []
  const results = []
  for (const doc of parsed.docs)
    results.push(await checkDoc(doc, cfg, syntax, out))
  if (parsed.mode === "grouped") checkRootRelation(parsed, results, out)
  return out
}

/** 1 つの文書（single・root・group）を検査する。3 章の関係図の辺（ノード名の組）を返す */
async function checkDoc(model, cfg, syntax, out) {
  const kind = model.kind
  const main = model.file
  const adder = (file) => (no, rule, msg) =>
    out.push(finding(file.rel, no, rule, msg))
  const add = adder(main)
  const secs = model.secs
  const relationEdges = []

  // ---- F-A01〜03: 見出し ----
  const hs = headings(main.lines)
  const h1s = hs.filter((h) => h.level === 1)
  if (
    !/^# \S.* アーキテクチャ$/.test(main.lines[0]?.text ?? "") ||
    h1s.length !== 1
  )
    add(
      1,
      "F-A01",
      "1行目は「# <名称> アーキテクチャ」の H1 にし、H1 は1つだけにする",
    )
  const h2s = secs.filter((s) => s.title !== null).map((s) => s.title)
  if (h2s.join("\n") !== ARCH_CHAPTERS.join("\n"))
    add(
      1,
      "F-A02",
      `H2 は「${ARCH_CHAPTERS.join("」「")}」をこの順で過不足なく置く（実際: ${h2s.join("、") || "なし"}）`,
    )
  const preamble = nonBlank(secs[0].lines).filter((l) => !/^#\s/.test(l.text))
  if (preamble.length > 0)
    add(preamble[0].no, "F-A02", "H1 と最初の H2 の間に本文を置かない")
  let currentH2 = null
  for (const l of main.lines) {
    if (l.code) continue
    const m = /^(#{2,6})\s+(.*?)\s*$/.exec(l.text)
    if (!m) continue
    if (m[1].length === 2) currentH2 = m[2]
    else if (m[1].length === 3 && currentH2 !== "5. 機能")
      add(l.no, "F-A03", "H3 は「5. 機能」の機能見出しだけに使う")
    else if (m[1].length >= 4) add(l.no, "F-A03", "H4 以下は使わない")
  }

  // ---- F-A04: 目的と範囲 ----
  const s1 = model.sec("1. 目的と範囲")
  if (s1) {
    const body = nonBlank(s1.lines)
    const bad = body.find((l) =>
      /^\s*([-*]|\d+\.)\s|^\s*[|#]|^\s*```/.test(l.text),
    )
    if (body.length === 0) add(s1.no, "F-A04", "目的と範囲が空")
    else if (bad)
      add(bad.no, "F-A04", "箇条書き・表・見出し・コードは使わず地の文で書く")
    const chars = len(body.map((l) => l.text.trim()).join(""))
    if (chars > LIMIT.purposeChars)
      add(s1.no, "F-A04", `${chars} 文字（上限 ${LIMIT.purposeChars} 文字）`)
  }

  // ---- F-A05: 表の章 ----
  const names = {
    internal: new Set(),
    external: new Set(),
    other: new Set(),
    all: new Set(),
  }
  for (const c of model.components) {
    names.all.add(c.name)
    if (c.kind === "外部") names.external.add(c.name)
    else if (c.kind === "他機能") names.other.add(c.name)
    else names.internal.add(c.name)
  }
  for (const [chapter, header] of Object.entries(archTables(kind))) {
    const s = model.sec(chapter)
    if (!s) continue
    const body = nonBlank(s.lines)
    const none = body.length === 1 && NONE.test(body[0].text.trim())
    const isIf = chapter === "4. 外部インターフェース"
    if (none) {
      if (chapter === "2. 構成要素")
        add(s.no, "F-A05", "構成要素は「- なし」にできない")
      if (isIf && names.external.size > 0)
        add(
          s.no,
          "F-A05",
          "外部の構成要素があるため、外部インターフェースを書く",
        )
      continue
    }
    const table = parseTable(s.lines)
    if (!table) {
      add(
        s.no,
        "F-A05",
        `表（${header.join(" | ")}）がない（該当なしは「- なし」）`,
      )
      continue
    }
    if (table.header.join("\n") !== header.join("\n") || !table.separator)
      add(
        table.headerNo,
        "F-A05",
        `列見出しは「| ${header.join(" | ")} |」と区切り行にする`,
      )
    if (table.rows.length === 0)
      add(table.headerNo, "F-A05", "表にデータ行がない")
    for (const r of table.rows) {
      if (r.cells.length !== header.length)
        add(r.no, "F-A05", `列数は ${header.length}（実際: ${r.cells.length}）`)
      for (const cell of r.cells) {
        if (cell === "") add(r.no, "F-A05", "空のセルがある")
        if (len(cell) > LIMIT.cell)
          add(
            r.no,
            "F-A05",
            `セルが ${len(cell)} 文字（上限 ${LIMIT.cell} 文字）`,
          )
        if (cell.includes("。")) add(r.no, "F-A05", "セルに「。」を含めない")
      }
    }
    // 表以外の行: 4 章は説明と図、そのほかは置かない
    if (!isIf) {
      const extra = nonBlank(nonTable(s.lines)).filter(
        (l) => !NONE.test(l.text.trim()),
      )
      if (extra.length > 0) add(extra[0].no, "F-A05", "表以外の行を置かない")
    }
  }

  // ---- F-A06: 構成要素表の意味 ----
  const kinds = COMPONENT_KINDS[kind]
  const seenNames = new Map()
  for (const c of model.components) {
    if (seenNames.has(c.name))
      add(
        c.no,
        "F-A06",
        `構成要素名「${c.name}」が重複している（初出: ${seenNames.get(c.name)} 行）`,
      )
    else seenNames.set(c.name, c.no)
    if (len(c.name) > LIMIT.name)
      add(
        c.no,
        "F-A06",
        `構成要素名が ${len(c.name)} 文字（上限 ${LIMIT.name} 文字）`,
      )
    if (!kinds.includes(c.kind))
      add(c.no, "F-A06", `種別は「${kinds.join("」「")}」（実際: ${c.kind}）`)
    else if (c.kind === "内部" && kind === "root") {
      if (
        !c.link ||
        c.link.title !== c.name ||
        !/^[a-z0-9][a-z0-9-]*\.md$/.test(c.link.target)
      )
        add(
          c.no,
          "F-A06",
          `機能のくくりの詳細は「[${c.name}](architecture/<ファイル>.md)」にする（実際: ${c.detail}）`,
        )
    } else if (c.kind === "内部" && c.specs.length === 0)
      add(c.no, "F-A06", "内部の構成要素は実装spec を1件以上書く")
    else if (c.kind !== "内部") {
      const noRef = kind === "root" ? c.detail === "-" : c.specs.length === 0
      if (!noRef)
        add(
          c.no,
          "F-A06",
          `${c.kind}の構成要素の${kind === "root" ? "詳細" : "実装spec"}は「-」にする`,
        )
    }
  }
  if (model.components.length > 0 && names.internal.size === 0)
    add(model.sec("2. 構成要素").no, "F-A06", "内部の構成要素を1件以上置く")

  // ---- F-A07: 外部インターフェース表の意味 ----
  const ifSeen = new Map()
  const usedExternal = new Set()
  for (const i of model.interfaces) {
    if (ifSeen.has(i.name))
      add(
        i.no,
        "F-A07",
        `IF 名「${i.name}」が重複している（初出: ${ifSeen.get(i.name)} 行）`,
      )
    else ifSeen.set(i.name, i.no)
    if (i.dir !== "提供" && i.dir !== "利用")
      add(i.no, "F-A07", `方向は「提供」か「利用」（実際: ${i.dir}）`)
    if (!names.external.has(i.ext))
      add(i.no, "F-A07", `外部の要素「${i.ext}」が構成要素表の外部にない`)
    else usedExternal.add(i.ext)
    if (!names.internal.has(i.int))
      add(i.no, "F-A07", `内部の要素「${i.int}」が構成要素表の内部にない`)
  }
  const s4 = model.sec("4. 外部インターフェース")
  if (model.interfaces.length > 0)
    for (const e of [...names.external].sort())
      if (!usedExternal.has(e))
        add(s4.no, "F-A07", `外部の要素「${e}」がどの IF にも現れない`)

  // ---- 図: 3 章（内部の関係図。くくりの文書は他機能も置ける） ----
  const s3 = model.sec("3. システム構成")
  const covered = new Set()
  const pool = new Set([...names.internal, ...names.other])
  if (s3) {
    const body = nonBlank(s3.lines)
    const none = body.length === 1 && NONE.test(body[0].text.trim())
    if (none) {
      if (pool.size > 1)
        add(s3.no, "F-A08", "内部の構成要素が複数あるため、関係図を置く")
    } else {
      const items = splitChapter(s3, add)
      const diagrams = []
      for (const it of items) {
        if (!it.block.close) continue
        const d = await analyzeDiagram(it, add, syntax, {
          ext: true,
          minNodes: 2,
        })
        if (!d) continue
        if (d.group !== "relation") {
          add(
            it.block.open.no,
            "F-A08",
            "3 章には関係図（flowchart／classDiagram）だけを置く",
          )
          continue
        }
        for (const n of d.nodes.values()) {
          if (n.id.startsWith("ext_"))
            add(
              n.no,
              "F-A08",
              `内部の関係図に外部の要素「${n.label}」を置かない`,
            )
          else if (!pool.has(n.label))
            add(
              n.no,
              "F-A08",
              `「${n.label}」は構成要素表の内部${kind === "group" ? "・他機能" : ""}にない`,
            )
          else covered.add(n.label)
        }
        for (const e of d.edges) {
          const from = d.nodes.get(e.from)?.label
          const to = d.nodes.get(e.to)?.label
          if (names.other.has(from) && names.other.has(to))
            add(e.no, "F-A08", `他機能どうし（${from}、${to}）を辺で結ばない`)
          else relationEdges.push({ from, to, no: e.no })
        }
        diagrams.push(d)
      }
      if (diagrams.length < 1 || diagrams.length > 3)
        add(s3.no, "F-A08", `関係図は 1〜3 個（実際: ${diagrams.length} 個）`)
      for (const n of [...pool].sort())
        if (!covered.has(n))
          add(
            s3.no,
            "F-A08",
            `${names.other.has(n) ? "他機能" : "内部"}の要素「${n}」が関係図にない`,
          )
      checkCycle(diagrams, add)
    }
  }

  // ---- 図: 4 章（境界図） ----
  if (s4) {
    const body = nonBlank(s4.lines)
    const none = body.length === 1 && NONE.test(body[0].text.trim())
    if (!none && model.interfaces.length > 0) {
      const items = splitChapter({ lines: nonTable(s4.lines) }, add)
      const diagrams = []
      for (const it of items) {
        if (!it.block.close) continue
        const d = await analyzeDiagram(it, add, syntax, {
          ext: true,
          minNodes: 2,
          looseEdges: true,
        })
        if (d) diagrams.push(d)
      }
      if (diagrams.length !== 1)
        add(
          s4.no,
          "F-A09",
          `境界図は1個だけ置く（実際: ${diagrams.length} 個）`,
        )
      const d = diagrams[0]
      if (d && d.kind !== "flowchart")
        add(d.open.no, "F-A09", "境界図は flowchart にする")
      else if (d) checkBoundary(d, model, names, add)
    }
  }

  // ---- 5 章: 機能 ----
  const s5 = model.sec("5. 機能")
  const workflow = []
  if (s5) {
    const body = nonBlank(s5.lines)
    const none = body.length === 1 && NONE.test(body[0].text.trim())
    if (!none) {
      const stray = nonBlank(model.preface)[0]
      if (stray)
        add(
          stray.no,
          "F-A10",
          "5 章の H3 より前に本文を置かない（機能は H3 の見出しから始める）",
        )
      if (model.functions.length === 0)
        add(s5.no, "F-A10", "機能がない（なしは「- なし」）")
    }
  }
  if (model.functions.length > cfg.maxFunctions)
    add(
      s5?.no ?? 1,
      "F-A18",
      `機能が ${model.functions.length} 件（上限 ${cfg.maxFunctions} 件）。複数の要素にまたがる主要な流れだけを書く`,
    )
  const titles = new Map()
  const sets = []
  for (const fn of model.functions) {
    const fa = adder(fn.file)
    if (!fn.title || len(fn.title) > LIMIT.name)
      fa(
        fn.no,
        "F-A10",
        `機能名は 1〜${LIMIT.name} 文字（実際: 「${fn.title}」）`,
      )
    if (titles.has(fn.title))
      fa(fn.no, "F-A10", `機能名「${fn.title}」が重複している`)
    titles.set(fn.title, true)
    // 行数
    const lines = fn.lines.length + 1
    if (lines > cfg.maxFunctionLines)
      fa(
        fn.no,
        "F-A13",
        `機能「${fn.title}」が ${lines} 行（上限 ${cfg.maxFunctionLines} 行）。流れを絞るか、機能を分ける`,
      )
    // 関与
    if (!fn.involved) {
      fa(
        fn.no,
        "F-A10",
        `機能「${fn.title}」の最初の行を「- 関与: 要素, 要素」にする`,
      )
      continue
    }
    const uniq = new Set(fn.involved)
    if (uniq.size !== fn.involved.length)
      fa(fn.involvedNo, "F-A11", "関与に同じ名前が重複している")
    const [minC, maxC] = cfg.functionComponents
    if (uniq.size < minC || uniq.size > maxC)
      fa(
        fn.involvedNo,
        "F-A11",
        `関与は ${minC}〜${maxC} 件（実際: ${uniq.size} 件）。多いときは機能を分ける`,
      )
    for (const n of uniq)
      if (!names.all.has(n))
        fa(fn.involvedNo, "F-A11", `関与「${n}」が構成要素表にない`)
    // F-A17: 外部の要素を含むか、外部以外が 3 件以上
    const externals = [...uniq].filter((n) => names.external.has(n)).length
    if (externals === 0 && uniq.size < 3)
      fa(
        fn.involvedNo,
        "F-A17",
        `機能「${fn.title}」は外部の要素を含まず、関与も ${uniq.size} 件のため、要素どうしの呼び出しにとどまる。その要素の spec の設計書に書く`,
      )
    const entry = { fn, set: uniq, msgs: new Set() }
    sets.push(entry)
    // 図
    const chapter = { lines: fn.lines.filter((l) => l.no !== fn.involvedNo) }
    const items = splitChapter(chapter, fa)
    const diagrams = []
    for (const it of items) {
      if (!it.block.close) continue
      const d = await analyzeDiagram(it, fa, syntax, { ext: true, minNodes: 2 })
      if (d) diagrams.push(d)
    }
    if (diagrams.length !== 1)
      fa(
        fn.no,
        "F-A10",
        `機能「${fn.title}」のワークフロー図は1個だけ置く（実際: ${diagrams.length} 個）`,
      )
    const d = diagrams[0]
    if (!d) continue
    if (d.group !== "workflow") {
      fa(
        d.open.no,
        "F-A10",
        "機能の図は sequenceDiagram か stateDiagram-v2 にする",
      )
      continue
    }
    workflow.push(d)
    for (const e of d.edges) if (e.label) entry.msgs.add(e.label)
    if (d.kind === "sequenceDiagram") {
      const labels = new Set()
      for (const n of d.nodes.values()) {
        const ext = n.id.startsWith("ext_")
        if (ext !== names.external.has(n.label) || !names.all.has(n.label))
          fa(
            n.no,
            "F-A11",
            names.all.has(n.label)
              ? `「${n.label}」は構成要素表の${names.external.has(n.label) ? "外部のため ID を ext_ で始める" : "内部のため ext_ を付けない"}`
              : `「${n.label}」は構成要素表にない`,
          )
        labels.add(n.label)
      }
      for (const n of uniq)
        if (!labels.has(n))
          fa(fn.involvedNo, "F-A11", `関与「${n}」がシーケンス図の参加者にない`)
      for (const n of labels)
        if (!uniq.has(n)) fa(d.open.no, "F-A11", `参加者「${n}」が関与にない`)
    }
  }
  // F-A14: 同じ振る舞いの重複（関与の集合と図のメッセージ名の集合がどちらも似ている機能）
  const jaccard = (a, b) => {
    const inter = [...a].filter((x) => b.has(x)).length
    const union = a.size + b.size - inter
    return union === 0 ? 0 : inter / union
  }
  for (let i = 0; i < sets.length; i++)
    for (let j = i + 1; j < sets.length; j++) {
      const simSet = jaccard(sets[i].set, sets[j].set)
      const simMsg = jaccard(sets[i].msgs, sets[j].msgs)
      if (simSet >= cfg.mergeSimilarity && simMsg >= cfg.mergeSimilarity)
        adder(sets[j].fn.file)(
          sets[j].fn.no,
          "F-A14",
          `機能「${sets[j].fn.title}」と「${sets[i].fn.title}」は、関与（類似度 ${simSet.toFixed(2)}）と図のメッセージ名（類似度 ${simMsg.toFixed(2)}）がどちらも ${cfg.mergeSimilarity} 以上で、同じ振る舞いとみなせる。統合する`,
        )
    }
  if (workflow.length > 0 && !workflow.some(hasBranch))
    add(
      s5?.no ?? 1,
      "G011",
      "ワークフロー図に分岐がない（alt／opt／break、または2本以上の遷移が出る状態を含める）",
    )

  // ---- F-A19: くくりの規模 ----
  if (kind === "root" || kind === "group") {
    const [lo, hi] = kind === "root" ? cfg.groupCount : cfg.groupComponents
    const n = names.internal.size
    if (n < lo || n > hi)
      add(
        model.sec("2. 構成要素")?.no ?? 1,
        "F-A19",
        kind === "root"
          ? `機能のくくりは ${lo}〜${hi} 個（実際: ${n} 個）`
          : `くくりの文書の内部の要素は ${lo}〜${hi} 個（実際: ${n} 個）。くくりの切り方を見直す`,
      )
  }

  // ---- F-A12: 根拠 ----
  for (const [chapter, col, name] of [
    ["7. 信頼と検証", 3, "根拠"],
    ["8. 技術基盤", 3, "根拠"],
    ["9. 横断的制約", 2, "根拠"],
  ]) {
    const t = model.table(chapter)
    for (const r of t?.rows ?? []) {
      const cell = r.cells[col] ?? ""
      const refs =
        cell === "" ? [] : cell.replace(/`/g, "").split(/\s*[,、]\s*/)
      if (
        refs.length === 0 ||
        refs.some(
          (x) =>
            !(pocThemeOf(x) !== null || /^[a-z0-9][a-z0-9-]*$/.test(x)) ||
            x === "",
        )
      )
        add(
          r.no,
          "F-A12",
          `${name}は spec 名か poc/<テーマ> を「、」区切りで書く（実際: ${cell}）`,
        )
      if (chapter === "9. 横断的制約" && !/\d/.test(r.cells[1] ?? ""))
        add(r.no, "F-A12", "横断的制約の値は数値を含める")
    }
  }

  // ---- F-A13: 文書の行数 ----
  const maxLines = kind === "group" ? cfg.maxGroupLines : cfg.maxLines
  if (main.lines.length > maxLines)
    add(
      1,
      "F-A13",
      `${main.lines.length} 行（上限 ${maxLines} 行）。${kind === "single" ? "記述を減らす。内部の構成要素が多いときはくくり別の文書に分ける" : kind === "root" ? "くくりの詳細は各くくりの文書に置き、全体は要約と横断だけにする" : "くくりの切り方を見直す"}`,
    )
  return { edges: relationEdges }
}

/** F-A20: 全体の関係図の辺と、くくりの文書の「他機能」から導いた依存 */
function checkRootRelation(parsed, results, out) {
  const root = parsed.main
  const owner = new Map()
  for (const g of parsed.groups) {
    if (!g.name) continue
    for (const c of g.model.components)
      if (c.kind === "内部" && !owner.has(c.name)) owner.set(c.name, g.name)
  }
  const derived = new Map()
  parsed.groups.forEach((g, i) => {
    if (!g.name) return
    const others = new Set(
      g.model.components.filter((c) => c.kind === "他機能").map((c) => c.name),
    )
    for (const e of results[i + 1].edges) {
      const fromOther = others.has(e.from)
      const toOther = others.has(e.to)
      if (fromOther === toOther) continue
      const from = fromOther ? owner.get(e.from) : g.name
      const to = toOther ? owner.get(e.to) : g.name
      if (!from || !to || from === to) continue
      if (!derived.has(`${from}→${to}`))
        derived.set(`${from}→${to}`, { from, to, rel: g.model.file.rel })
    }
  })
  const rootEdges = new Map()
  for (const e of results[0].edges)
    if (!rootEdges.has(`${e.from}→${e.to}`))
      rootEdges.set(`${e.from}→${e.to}`, e)
  const s3no = root.sec("3. システム構成")?.no ?? 1
  const add = (no, msg) => out.push(finding(root.file.rel, no, "F-A20", msg))
  for (const [k, d] of derived)
    if (!rootEdges.has(k))
      add(
        s3no,
        `くくり「${d.from}」→「${d.to}」の依存（${d.rel} の他機能から導く）が全体の関係図にない`,
      )
  for (const [k, e] of rootEdges)
    if (!derived.has(k))
      add(
        e.no,
        `全体の関係図の辺「${e.from} → ${e.to}」に対応する他機能の記載が、くくりの文書の関係図にない`,
      )
}

/** 境界図（F-A09）: ノード名と、表の行 ↔ 辺の一対一・向き */
function checkBoundary(d, model, names, add) {
  const nodeInfo = (id) => d.nodes.get(id)
  for (const n of d.nodes.values()) {
    const ext = n.id.startsWith("ext_")
    if (names.other.has(n.label))
      add(n.no, "F-A09", `他機能の要素「${n.label}」は境界図に置かない`)
    else if (!names.all.has(n.label))
      add(n.no, "F-A09", `「${n.label}」は構成要素表にない`)
    else if (ext !== names.external.has(n.label))
      add(
        n.no,
        "F-A09",
        names.external.has(n.label)
          ? `外部の要素「${n.label}」の ID は ext_ で始める`
          : `内部の要素「${n.label}」の ID に ext_ を付けない`,
      )
  }
  const matched = new Set()
  for (const e of d.edges) {
    const row = model.interfaces.find((i) => i.name === e.label)
    if (!row) {
      add(
        e.no,
        "F-A09",
        `辺の名前「${e.label}」が外部インターフェース表の IF にない`,
      )
      continue
    }
    matched.add(row.name)
    const from = nodeInfo(e.from)?.label
    const to = nodeInfo(e.to)?.label
    const want = row.dir === "提供" ? [row.ext, row.int] : [row.int, row.ext]
    if (from !== want[0] || to !== want[1])
      add(
        e.no,
        "F-A09",
        `IF「${row.name}」は方向「${row.dir}」のため「${want[0]} → ${want[1]}」にする（実際: ${from} → ${to}）`,
      )
  }
  for (const i of model.interfaces)
    if (!matched.has(i.name))
      add(d.open.no, "F-A09", `IF「${i.name}」の辺が境界図にない`)
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = await runCli([{ title, rules, check }])
}
