/**
 * 図チェック: design.md の「2. 関係図・ワークフロー」を検証する。
 *
 * - 構成表が 4 行以上の spec は、関係図とワークフロー図（mermaid）を必須とする
 * - 図の記法を部分集合に絞った自前のパーサで解析し、形だけの図・冗長な図を機械的に弾く
 * - 図と構成表・設計項目の対応（C1〜C5）で、図の更新漏れを検出する
 * - 構文の正しさだけは mermaid.parse に任せる（G014。依存は mermaid-syntax.mjs を参照）
 *
 * 許可する記法は rules の G005 を参照する。
 */
import { pathToFileURL } from "node:url"
import { syntaxError } from "./mermaid-syntax.mjs"
import {
  codeBlocks,
  finding,
  isTableLine,
  nonBlank,
  runCli,
  sectionsByH2,
  splitRow,
} from "./lib.mjs"

export const title = "図チェック（check-diagram）"

const LIMIT = {
  exemptRows: 3, // 構成表がこの行数以下なら図を免除する
  perGroup: 2, // 関係図・ワークフロー図それぞれの個数上限
  minNodes: 3,
  maxNodes: 20,
  label: 30, // ノード名・メッセージ名・遷移ラベル（文字数）
  member: 40, // classDiagram のメンバー行
  caption: 80, // 図の説明文
  captionLabels: 3, // 説明文に含めてよいノード名は 2 個まで
  stateName: 15,
  transition: 15,
  transitionsPerState: 3,
}

const CHAPTER = "2. 関係図・ワークフロー"
const COMPONENT = "1. 構成"
const ITEMS = "3. 設計項目"

export const rules = {
  G001: `構成表が ${LIMIT.exemptRows + 1} 行以上の spec は「${CHAPTER}」に図を置く。${LIMIT.exemptRows} 行以下は図を置くか「- なし」と書く`,
  G002: `「${CHAPTER}」は「説明1行 → mermaid ブロック」の繰り返しのみで書く（箇条書き・表・見出し・他言語のコードブロックを置かない）`,
  G003: `図の説明は「。」で終わる1文（${LIMIT.caption}文字以内）とし、その図のノード名（状態名を含む）を ${LIMIT.captionLabels} 個以上含めない（図の言い換えの禁止）`,
  G004: `図種は関係図（flowchart／classDiagram）とワークフロー図（sequenceDiagram／stateDiagram-v2）の4種のみとし、それぞれ 1〜${LIMIT.perGroup} 個置く`,
  G005: '図の記法は次の部分集合のみ使う。flowchart: `ID["名"]`・`A --> B`・`A -->|ラベル| B`・`subgraph 題`／`end`。classDiagram: `class ID`・`ID : メンバー`・`A --> B`／`..>`／`--|>`／`..|>`（`: ラベル` 可）。sequenceDiagram: `participant ID as 名`・`A->>B: 文言`・`A-->>B: 文言`・`alt|opt|break|loop 条件`／`else 条件`／`end`。stateDiagram-v2: `state "名" as ID`・`S --> T: ラベル`・`[*]`。コメントは `%%`',
  G006: `1図あたりノードは ${LIMIT.minNodes}〜${LIMIT.maxNodes} 個、エッジ（メッセージ・遷移）は「ノード数−1」本以上、孤立ノードなし。ノード名・エッジ名は ${LIMIT.label} 文字以内（classDiagram のメンバーは ${LIMIT.member} 文字以内）で「。」を含めない`,
  G007: "C1: 関係図・シーケンス図のノードは、構成表のパスのベース名（拡張子なし。同名が複数あるときは「親ディレクトリ/名」）と一致するか、外部要素として ID を ext_ で始める",
  G008: "C2: 構成表のすべての行が、いずれかの関係図に内部ノードとして現れる",
  G009: "C3: 関係図の依存（A --> B は A が B に依存）に循環がない",
  G010: "C4: 設計項目のコードブロック（ts／tsx／js／jsx）で export した関数・クラス・定数の名前が、いずれかの図のラベルに現れる",
  G011: "C5: ワークフロー図の少なくとも1つに分岐がある（alt／opt／break、または2本以上の遷移が出る状態）",
  G012: `状態図の状態 ID は ASCII の PascalCase、状態名（\`state "名" as ID\` の名、なければ ID）は ${LIMIT.stateName} 文字以内で空白・句読点を含めない。遷移ラベルは ${LIMIT.transition} 文字以内で「。」を含めない`,
  G013: `状態図は開始遷移（[*] --> S）をちょうど1本持ち、全状態が開始から到達可能で、すべての状態が出る遷移を持つ（終了は --> [*] で明示する）。同一遷移の重複と、状態数×${LIMIT.transitionsPerState} 本を超える遷移を置かない`,
  G014: "図の構文が Mermaid（mermaid.parse）で解釈できる。G004／G005 の指摘がある図は、それを直してから検査する。依存は scripts/ に導入する（npm ci --ignore-scripts --prefix <scripts のパス>）",
}

const KINDS = {
  flowchart: { re: /^flowchart (?:TD|TB|BT|LR|RL)$/, group: "relation" },
  classDiagram: { re: /^classDiagram$/, group: "relation" },
  sequenceDiagram: { re: /^sequenceDiagram$/, group: "workflow" },
  "stateDiagram-v2": { re: /^stateDiagram-v2$/, group: "workflow" },
}

const ID = "[A-Za-z_]\\w*"
const len = s => [...s].length
const unquote = s => s.trim().replace(/^"(.*)"$/, "$1")

// ---------------------------------------------------------------------------
// 図の解析
// ---------------------------------------------------------------------------

/**
 * mermaid ブロックを部分集合の文法で解析する。
 * 戻り値: { kind, group, nodes: Map, edges, texts, branch, errors, ... }
 */
function parseDiagram(block) {
  const d = {
    kind: null,
    group: null,
    open: block.open,
    nodes: new Map(), // id → { id, label, explicit, no }
    edges: [], // { from, to, label, no }
    texts: [], // C4 用: 図中のラベル文字列
    members: [], // classDiagram のメンバー行 { text, no }
    labelsToCheck: [], // 文字数検査の対象 { text, no, max }
    branch: false,
    errors: [], // G005
    stateDecls: [], // 状態図の状態宣言
  }
  const bad = (no, msg) => d.errors.push({ no, msg })
  const node = (id, label, no) => {
    const cur = d.nodes.get(id)
    if (!cur) {
      d.nodes.set(id, {
        id,
        label: label ?? id,
        explicit: label !== undefined,
        no,
      })
    } else if (label !== undefined) {
      if (cur.explicit && cur.label !== label)
        bad(no, `ノード ${id} のラベルが重複定義されている`)
      cur.label = label
      cur.explicit = true
    }
  }
  const edge = (from, to, label, no) => d.edges.push({ from, to, label, no })

  const body = block.lines
    .map(l => ({ no: l.no, t: l.text.trim() }))
    .filter(l => l.t !== "" && !l.t.startsWith("%%"))
  const head = body.shift()
  if (!head) {
    bad(block.open.no, "図が空")
    return d
  }
  const kind = Object.keys(KINDS).find(k => KINDS[k].re.test(head.t))
  if (!kind) {
    bad(
      head.no,
      `図種が不正（flowchart TD|TB|BT|LR|RL／classDiagram／sequenceDiagram／stateDiagram-v2 のいずれかで始める）: ${head.t}`,
    )
    return d
  }
  d.kind = kind
  d.group = KINDS[kind].group

  const stack = [] // flowchart の subgraph／sequence のブロック
  for (const { no, t } of body) {
    let m
    if (kind === "flowchart") {
      if ((m = /^subgraph (\S.*)$/.exec(t))) {
        stack.push("subgraph")
        d.texts.push(m[1])
        d.labelsToCheck.push({ text: m[1], no, max: LIMIT.label })
      } else if (t === "end") {
        if (stack.pop() !== "subgraph") bad(no, "対応する subgraph がない end")
      } else {
        const chain = parseChain(t)
        if (!chain) {
          bad(no, `未対応の記法: ${t}`)
          continue
        }
        chain.eps.forEach(e => node(e.id, e.label, no))
        chain.arrows.forEach((label, i) =>
          edge(chain.eps[i].id, chain.eps[i + 1].id, label, no),
        )
      }
    } else if (kind === "classDiagram") {
      if ((m = new RegExp(`^class (${ID})(?:\\["([^"\\n]*)"\\])?$`).exec(t))) {
        node(m[1], m[2], no)
      } else if (
        (m = new RegExp(
          `^(${ID}) (-->|\\.\\.>|--\\|>|\\.\\.\\|>) (${ID})(?: : (\\S.*))?$`,
        ).exec(t))
      ) {
        node(m[1], undefined, no)
        node(m[3], undefined, no)
        edge(m[1], m[3], m[4] ?? "", no)
      } else if ((m = new RegExp(`^(${ID}) : (\\S.*)$`).exec(t))) {
        node(m[1], undefined, no)
        d.members.push({ text: m[2], no })
      } else bad(no, `未対応の記法: ${t}`)
    } else if (kind === "sequenceDiagram") {
      if ((m = new RegExp(`^participant (${ID})(?: as (\\S.*))?$`).exec(t))) {
        node(m[1], m[2] === undefined ? undefined : unquote(m[2]), no)
      } else if (
        (m = new RegExp(`^(${ID}) ?(-->>|->>) ?(${ID}) ?: (\\S.*)$`).exec(t))
      ) {
        node(m[1], undefined, no)
        node(m[3], undefined, no)
        edge(m[1], m[3], m[4].trim(), no)
      } else if ((m = /^(alt|opt|break|loop) (\S.*)$/.exec(t))) {
        stack.push(m[1])
        if (m[1] !== "loop") d.branch = true
        d.texts.push(m[2])
        d.labelsToCheck.push({ text: m[2], no, max: LIMIT.label })
      } else if ((m = /^else (\S.*)$/.exec(t))) {
        if (stack.at(-1) !== "alt") bad(no, "alt の外にある else")
        d.texts.push(m[1])
        d.labelsToCheck.push({ text: m[1], no, max: LIMIT.label })
      } else if (t === "end") {
        if (stack.pop() === undefined) bad(no, "対応するブロックがない end")
      } else bad(no, `未対応の記法: ${t}`)
    } else {
      // stateDiagram-v2
      if ((m = new RegExp(`^state "([^"\\n]+)" as (${ID})$`).exec(t))) {
        d.stateDecls.push({ id: m[2], no })
        node(m[2], m[1], no)
      } else if (
        (m = new RegExp(
          `^(\\[\\*\\]|${ID}) --> (\\[\\*\\]|${ID})(?: ?: (\\S.*))?$`,
        ).exec(t))
      ) {
        for (const id of [m[1], m[2]]) if (id !== "[*]") node(id, undefined, no)
        edge(m[1], m[2], (m[3] ?? "").trim(), no)
      } else bad(no, `未対応の記法: ${t}`)
    }
  }
  if (stack.length > 0)
    bad(block.close?.no ?? head.no, "end で閉じられていないブロックがある")

  for (const n of d.nodes.values()) d.texts.push(n.label)
  for (const e of d.edges) if (e.label) d.texts.push(e.label)
  for (const mem of d.members) d.texts.push(mem.text)
  return d
}

/** flowchart の「A --> B -->|ラベル| C」形式の1行を解析する */
function parseChain(text) {
  const EP = new RegExp(`^(${ID})(?:\\["([^"\\n]*)"\\])?`)
  const eps = []
  const arrows = []
  let rest = text.trim()
  let m = EP.exec(rest)
  if (!m) return null
  eps.push({ id: m[1], label: m[2] })
  rest = rest.slice(m[0].length).trimStart()
  while (rest !== "") {
    const a = /^-->(?:\|([^|\n]*)\|)?\s*/.exec(rest)
    if (!a) return null
    arrows.push((a[1] ?? "").trim())
    rest = rest.slice(a[0].length)
    m = EP.exec(rest)
    if (!m) return null
    eps.push({ id: m[1], label: m[2] })
    rest = rest.slice(m[0].length).trimStart()
  }
  return { eps, arrows }
}

// ---------------------------------------------------------------------------
// 構成表・設計項目からの情報取得
// ---------------------------------------------------------------------------

/** 構成表の行から、図で使うノード名（ベース名）を求める */
function componentNames(sec) {
  if (!sec) return []
  const paths = nonBlank(sec.lines)
    .filter(isTableLine)
    .slice(2)
    .map(l => splitRow(l.text)[0]?.replace(/^`|`$/g, ""))
    .filter(Boolean)
  const base = p =>
    p
      .split("/")
      .at(-1)
      .replace(/\.[^.]+$/, "")
  const counts = new Map()
  for (const p of paths) counts.set(base(p), (counts.get(base(p)) ?? 0) + 1)
  return paths.map(p => {
    const parent = p.split("/").at(-2)
    return counts.get(base(p)) > 1 && parent ? `${parent}/${base(p)}` : base(p)
  })
}

const JS_LANGS = new Set(["ts", "tsx", "typescript", "js", "jsx", "javascript"])
const EXPORT_RE =
  /^\s*export\s+(?:default\s+)?(?:declare\s+)?(?:async\s+)?(?:function\*?|class|const|let|var)\s+([A-Za-z_$][\w$]*)/

/** 設計項目のコードブロックから export 名を取り出す */
function exportedNames(sec) {
  const out = []
  if (!sec) return out
  for (const b of codeBlocks(sec.lines)) {
    if (!JS_LANGS.has(b.lang)) continue
    for (const l of b.lines) {
      const m = EXPORT_RE.exec(l.text)
      if (m) out.push({ name: m[1], no: l.no })
    }
  }
  return out
}

// ---------------------------------------------------------------------------
// 章の検査
// ---------------------------------------------------------------------------

/** 章を「説明 → mermaid ブロック」の組に分解する（G002） */
function splitChapter(chapter, add) {
  const items = []
  const blocks = codeBlocks(chapter.lines)
  let pending = null
  let bi = 0
  for (const l of chapter.lines) {
    if (l.code) {
      if (l.fence && blocks[bi] && l === blocks[bi].open) {
        const b = blocks[bi++]
        if (b.lang !== "mermaid") {
          add(l.no, "G002", "mermaid 以外のコードブロックを置かない")
        } else if (!b.close) {
          add(l.no, "G002", "コードブロックが閉じていない")
        } else {
          if (!pending) add(l.no, "G002", "図の直前に説明を1行置く")
          items.push({ caption: pending, block: b })
        }
        pending = null
      }
      continue
    }
    if (l.text.trim() === "") continue
    if (/^\s*([-*]|\d+\.)\s|^\s*\||^\s*#/.test(l.text)) {
      add(l.no, "G002", "箇条書き・表・見出しは置かない（説明1行と図のみ）")
      continue
    }
    if (pending) add(l.no, "G002", "説明は図1つにつき1行にする")
    pending = l
  }
  if (pending) add(pending.no, "G002", "説明の後に図がない")
  return items
}

function checkCaption(caption, d, add) {
  if (!caption) return
  const t = caption.text.trim()
  if (!t.endsWith("。") || t.split("。").length !== 2)
    add(caption.no, "G003", "説明は「。」で終わる1文にする")
  if (len(t) > LIMIT.caption)
    add(caption.no, "G003", `${len(t)} 文字（上限 ${LIMIT.caption} 文字）`)
  const labels = [...new Set([...d.nodes.values()].map(n => n.label))].filter(
    s => len(s) >= 2,
  )
  const hits = labels.filter(s => t.includes(s))
  if (hits.length >= LIMIT.captionLabels)
    add(
      caption.no,
      "G003",
      `説明にノード名が ${hits.length} 個含まれている（${hits.join("、")}）。図の言い換えはせず、図の主題だけを書く`,
    )
}

function checkScale(d, add) {
  const names = [...d.nodes.values()]
  if (names.length < LIMIT.minNodes || names.length > LIMIT.maxNodes)
    add(
      d.open.no,
      "G006",
      `ノードは ${LIMIT.minNodes}〜${LIMIT.maxNodes} 個（実際: ${names.length} 個）`,
    )
  if (d.edges.length < names.length - 1)
    add(
      d.open.no,
      "G006",
      `エッジは ${names.length - 1} 本以上（実際: ${d.edges.length} 本）`,
    )
  const used = new Set(d.edges.flatMap(e => [e.from, e.to]))
  for (const n of names)
    if (!used.has(n.id)) add(n.no, "G006", `孤立ノード ${n.id}（エッジがない）`)
  if (d.kind === "stateDiagram-v2") return // 文字数は G012
  const over = (text, max, no, what) => {
    if (len(text) > max)
      add(
        no,
        "G006",
        `${what}「${text}」が ${len(text)} 文字（上限 ${max} 文字）`,
      )
    if (text.includes("。")) add(no, "G006", `${what}に「。」を含めない`)
  }
  for (const n of names) over(n.label, LIMIT.label, n.no, "ノード名")
  for (const e of d.edges)
    if (e.label) over(e.label, LIMIT.label, e.no, "エッジ名")
  for (const x of d.labelsToCheck) over(x.text, x.max, x.no, "ブロック見出し")
  for (const mem of d.members) over(mem.text, LIMIT.member, mem.no, "メンバー")
}

function checkState(d, add) {
  const nodes = [...d.nodes.values()]
  const seenDecl = new Set()
  for (const x of d.stateDecls) {
    if (seenDecl.has(x.id))
      add(x.no, "G012", `状態 ${x.id} を重複して宣言している`)
    seenDecl.add(x.id)
  }
  for (const n of nodes) {
    if (!/^[A-Z][A-Za-z0-9]*$/.test(n.id))
      add(n.no, "G012", `状態 ID「${n.id}」は ASCII の PascalCase にする`)
    if (len(n.label) > LIMIT.stateName)
      add(
        n.no,
        "G012",
        `状態名「${n.label}」が ${len(n.label)} 文字（上限 ${LIMIT.stateName} 文字）`,
      )
    if (/[\s、。，．,.!?！？]/.test(n.label))
      add(n.no, "G012", `状態名「${n.label}」に空白・句読点を含めない`)
  }
  for (const e of d.edges) {
    if (len(e.label) > LIMIT.transition)
      add(
        e.no,
        "G012",
        `遷移ラベル「${e.label}」が ${len(e.label)} 文字（上限 ${LIMIT.transition} 文字）`,
      )
    if (e.label.includes("。"))
      add(e.no, "G012", "遷移ラベルに「。」を含めない")
  }

  // G013
  const starts = d.edges.filter(e => e.from === "[*]")
  if (starts.length !== 1)
    add(
      d.open.no,
      "G013",
      `開始遷移（[*] --> S）はちょうど1本（実際: ${starts.length} 本）`,
    )
  if (starts.some(e => e.to === "[*]"))
    add(starts[0].no, "G013", "[*] --> [*] は書かない")
  const out = new Map(nodes.map(n => [n.id, []]))
  for (const e of d.edges) if (e.from !== "[*]") out.get(e.from)?.push(e.to)
  const reach = new Set()
  const walk = id => {
    if (id === "[*]" || reach.has(id)) return
    reach.add(id)
    for (const t of out.get(id) ?? []) walk(t)
  }
  for (const s of starts) walk(s.to)
  for (const n of nodes) {
    if (starts.length > 0 && !reach.has(n.id))
      add(n.no, "G013", `状態 ${n.id} が開始から到達できない`)
    if ((out.get(n.id) ?? []).length === 0)
      add(
        n.no,
        "G013",
        `状態 ${n.id} から出る遷移がない（終了は --> [*] で明示する）`,
      )
  }
  const seen = new Set()
  for (const e of d.edges) {
    const key = `${e.from}\0${e.to}\0${e.label}`
    if (seen.has(key))
      add(e.no, "G013", `遷移 ${e.from} --> ${e.to} が重複している`)
    seen.add(key)
  }
  if (d.edges.length > nodes.length * LIMIT.transitionsPerState)
    add(
      d.open.no,
      "G013",
      `遷移が ${d.edges.length} 本（上限: 状態数 ${nodes.length} × ${LIMIT.transitionsPerState} = ${nodes.length * LIMIT.transitionsPerState} 本）`,
    )
}

/** ノードを構成表の名前または ext_ 接頭辞の外部要素として検証する（G007） */
function checkComponents(d, names, add) {
  const set = new Set(names)
  for (const n of d.nodes.values()) {
    if (n.id.startsWith("ext_")) {
      if (set.has(n.label))
        add(n.no, "G007", `構成表の要素「${n.label}」に ext_ を付けない`)
    } else if (!set.has(n.label)) {
      add(
        n.no,
        "G007",
        `「${n.label}」は構成表にない。外部要素なら ID を ext_ で始める（構成表の名前: ${[...set].join("、")}）`,
      )
    }
  }
}

/** 関係図の依存グラフに循環がないことを検証する（G009） */
function checkCycle(diagrams, add) {
  const key = (d, id) => {
    const n = d.nodes.get(id)
    return id.startsWith("ext_") ? id : (n?.label ?? id)
  }
  const adj = new Map()
  for (const d of diagrams)
    for (const e of d.edges) {
      const a = key(d, e.from)
      const b = key(d, e.to)
      if (!adj.has(a)) adj.set(a, [])
      adj.get(a).push({ to: b, no: e.no })
      if (!adj.has(b)) adj.set(b, [])
    }
  const state = new Map()
  const path = []
  const dfs = u => {
    state.set(u, 1)
    path.push(u)
    for (const { to, no } of adj
      .get(u)
      .slice()
      .sort((x, y) => (x.to < y.to ? -1 : 1))) {
      if (state.get(to) === 1) {
        const cyc = [...path.slice(path.indexOf(to)), to].join(" → ")
        add(no, "G009", `依存が循環している: ${cyc}`)
        return true
      }
      if (!state.has(to) && dfs(to)) return true
    }
    path.pop()
    state.set(u, 2)
    return false
  }
  for (const u of [...adj.keys()].sort()) if (!state.has(u) && dfs(u)) return
}

function hasBranch(d) {
  if (d.kind === "sequenceDiagram") return d.branch
  const outCount = new Map()
  for (const e of d.edges)
    if (e.from !== "[*]") outCount.set(e.from, (outCount.get(e.from) ?? 0) + 1)
  return [...outCount.values()].some(c => c >= 2)
}

async function checkDesign(f, add, syntax) {
  const secs = sectionsByH2(f.lines)
  const chapter = secs.find(s => s.title === CHAPTER)
  const comp = secs.find(s => s.title === COMPONENT)
  if (!chapter || !comp) return // 章の欠落は F-D02 が指摘する
  const names = componentNames(comp)
  const nb = nonBlank(chapter.lines)

  if (nb.length === 1 && nb[0].text.trim() === "- なし") {
    if (names.length > LIMIT.exemptRows)
      add(
        chapter.no,
        "G001",
        `構成表が ${names.length} 行あるため、関係図とワークフロー図を置く（免除は ${LIMIT.exemptRows} 行以下）`,
      )
    return
  }
  if (nb.length === 0) {
    add(
      chapter.no,
      "G001",
      "章が空（図を置くか、免除対象なら「- なし」と書く）",
    )
    return
  }

  const items = splitChapter(chapter, add)
  const diagrams = []
  for (const it of items) {
    if (!it.block.close) continue
    const d = parseDiagram(it.block)
    for (const e of d.errors)
      add(e.no, e.msg.startsWith("図種") ? "G004" : "G005", e.msg)
    if (d.kind) {
      checkCaption(it.caption, d, add)
      if (syntax && d.errors.length === 0) {
        const e = await syntax(it.block)
        if (e) add(e.no, "G014", e.message)
      }
      checkScale(d, add)
      if (d.kind === "stateDiagram-v2") checkState(d, add)
      if (d.group === "relation" || d.kind === "sequenceDiagram")
        checkComponents(d, names, add)
      diagrams.push(d)
    }
  }

  // G004: 図種ごとの個数
  const relation = diagrams.filter(d => d.group === "relation")
  const workflow = diagrams.filter(d => d.group === "workflow")
  for (const [label, list] of [
    ["関係図（flowchart／classDiagram）", relation],
    ["ワークフロー図（sequenceDiagram／stateDiagram-v2）", workflow],
  ]) {
    if (list.length < 1 || list.length > LIMIT.perGroup)
      add(
        chapter.no,
        "G004",
        `${label}は 1〜${LIMIT.perGroup} 個（実際: ${list.length} 個）`,
      )
  }

  // G008: 構成表の全行が関係図に現れる
  const inDiagram = new Set(
    relation.flatMap(d =>
      [...d.nodes.values()]
        .filter(n => !n.id.startsWith("ext_"))
        .map(n => n.label),
    ),
  )
  for (const n of names)
    if (!inDiagram.has(n))
      add(chapter.no, "G008", `構成表の「${n}」が関係図にない`)

  checkCycle(relation, add)

  // G010: export 名が図に現れる
  const texts = diagrams.flatMap(d => d.texts).join("\n")
  const items3 = secs.find(s => s.title === ITEMS)
  const seen = new Set()
  for (const { name, no } of exportedNames(items3)) {
    if (seen.has(name)) continue
    seen.add(name)
    const re = new RegExp(`(?<![\\w$])${name.replace(/\$/g, "\\$")}(?![\\w$])`)
    if (!re.test(texts))
      add(no, "G010", `export した「${name}」が図のラベルに現れない`)
  }

  // G011: 分岐
  if (workflow.length > 0 && !workflow.some(hasBranch))
    add(
      chapter.no,
      "G011",
      "ワークフロー図に分岐がない（alt／opt／break、または2本以上の遷移が出る状態を含める）",
    )
}

export async function check(ctx) {
  const out = []
  const syntax =
    ctx.options?.syntax === false
      ? null
      : block => syntaxError(block.lines, block.open.no)
  for (const spec of ctx.specs) {
    if (!ctx.targets.has(spec.name)) continue
    const d = spec.files.design
    if (!d) continue
    await checkDesign(
      d,
      (no, rule, msg) => out.push(finding(d.rel, no, rule, msg)),
      syntax,
    )
  }
  return out
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = await runCli([{ title, rules, check }])
}
