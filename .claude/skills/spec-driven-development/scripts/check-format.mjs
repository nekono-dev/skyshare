/**
 * 体裁チェック: 3ファイルが templates/ の雛形どおりの形状であることを検証する。
 *
 * - 見出しの構成・順序・階層
 * - 行形式と ID の連番（FR／NFR／AC／D／Phase／T）
 * - 要件 → 受け入れ条件 → 設計項目 → Phase のトレーサビリティ
 * - サイズ上限（行数・件数）
 */
import { pathToFileURL } from "node:url"
import {
  designIds,
  finding,
  headings,
  isTableLine,
  nonBlank,
  requirementIds,
  runCli,
  sectionsByH2,
  splitRow,
} from "./lib.mjs"

export const title = "体裁チェック（check-format）"

const LIMIT = {
  reqLines: 100,
  fr: 12,
  nfr: 8,
  sentence: 120,
  scopeItem: 100,
  purposeChars: 300,
  designLines: 300,
  dLines: 60,
  tasksLines: 100,
  phases: 5,
  tasksPerPhase: 8,
  tasksTotal: 30,
}

export const rules = {
  "F-R01":
    "requirements.md の1行目は「# <名称> 要件定義書」の H1 とし、H1 は1つだけにする",
  "F-R02":
    "requirements.md の H2 は「1. 目的」「2. スコープ」「3. 前提」「4. 機能要件」「5. 非機能要件」「6. 受け入れ条件」をこの順で過不足なく置き、H1 と最初の H2 の間に本文を置かない",
  "F-R03":
    "requirements.md の H3 は「2.1 対象」「2.2 対象外」のみ。H4 以下は使わない",
  "F-R04": "requirements.md に表・コードブロックを書かない",
  "F-R05": `目的は箇条書きにせず ${LIMIT.purposeChars} 文字以内の地の文で書く`,
  "F-R06": `対象・対象外は ${LIMIT.scopeItem} 文字以内の箇条書き（1件以上）のみで書く`,
  "F-R07":
    "前提は「- なし」または「- 前提: <spec名> — <理由>」の箇条書きのみで書く",
  "F-R08": `機能要件は「- FR-n: 〜。」、非機能要件は「- NFR-n: 〜。」（または「- なし」）の行のみとし、n は1からの連番にする。FR は1〜${LIMIT.fr}件、NFR は0〜${LIMIT.nfr}件`,
  "F-R09": `FR／NFR／AC の本文は「。」で終わる1文（${LIMIT.sentence}文字以内）とし、他の ID に言及しない`,
  "F-R10": "非機能要件は数値を含めて定量的に書く",
  "F-R11":
    "受け入れ条件は「- AC-n (FR-m): 〜。」の行のみとし、n は連番、参照先は存在する FR／NFR にする",
  "F-R12": "すべての FR／NFR に1件以上の受け入れ条件を対応させる",
  "F-R13": `requirements.md は ${LIMIT.reqLines} 行以内にする`,
  "F-D01":
    "design.md の1行目は「# <名称> 設計書」の H1 とし、H1 は1つだけにする",
  "F-D02":
    "design.md の H2 は「1. 構成」「2. 設計項目」「3. エラー処理」をこの順で過不足なく置き、H1 と最初の H2 の間に本文を置かない",
  "F-D03":
    "設計項目の H3 は「### D-n: <題> (FR-m, NFR-k)」とし、n は1からの連番にする。H3 は設計項目の中だけに置き、H4 以下は使わない",
  "F-D04":
    "構成は「| パス | 責務 |」の表のみで書き、パス列はバッククォートで囲む",
  "F-D05":
    "各設計項目は、コードブロックまたは表を1つ以上含む（ソースコード水準の具体性）",
  "F-D06": `各設計項目は ${LIMIT.dLines} 行以内にする`,
  "F-D07":
    "設計項目の参照先は requirements.md に存在する FR／NFR にし、すべての FR／NFR をいずれかの設計項目で参照する",
  "F-D08":
    "設計項目の本文で ID（D／FR／NFR／AC／T）に言及しない。対応関係は見出しのタグだけで表す",
  "F-D09": "エラー処理は「| 事象 | 処理 |」の表、または「- なし」のみで書く",
  "F-D10": `design.md は ${LIMIT.designLines} 行以内にする`,
  "F-T01":
    "tasks.md の1行目は「# <名称> タスク一覧」の H1 とし、H1 は1つだけにする",
  "F-T02": `tasks.md の H2 は「## Phase n: <名>」のみとし、n は1からの連番、${LIMIT.phases} Phase 以内にする。H1 と最初の H2 の間に本文を置かない`,
  "F-T03": "tasks.md で H3 以下は使わない",
  "F-T04": `各 Phase のタスクは「- [ ] T-p.m: 〜」（p は Phase 番号、m は連番）の1行（${LIMIT.sentence}文字以内）とし、1 Phase あたり1〜${LIMIT.tasksPerPhase}件にする`,
  "F-T05":
    "各 Phase に「- 検証: 」行を1つ置き、実行するコマンドまたはテストをバッククォートで示す",
  "F-T06":
    "UI に関わる Phase（.tsx／.astro／.css／コンポーネント／画面／ページ／UI を含む）には「- E2E: `tests/e2e/<名>.spec.ts` <操作> → <期待結果>」行を置き、Playwright のテストファイルを明示する",
  "F-T07":
    "各 Phase の行は「- 対応:」→ タスク → 「- 検証:」→（「- E2E:」）の順のみとし、それ以外の行を置かない",
  "F-T08":
    "各 Phase の「- 対応: D-n, …」は design.md に存在する D を参照し、すべての D をちょうど1つの Phase に割り当てる",
  "F-T09": `タスクは合計 ${LIMIT.tasksTotal} 件以内にする`,
  "F-T10": `tasks.md は ${LIMIT.tasksLines} 行以内にする`,
}

const REQ_H2 = [
  "1. 目的",
  "2. スコープ",
  "3. 前提",
  "4. 機能要件",
  "5. 非機能要件",
  "6. 受け入れ条件",
]
const DES_H2 = ["1. 構成", "2. 設計項目", "3. エラー処理"]

const ID_TOKEN = /\b(?:D|N?FR|AC|T)-\d+(?:\.\d+)?\b/

function checkH1(f, suffix, rule, add) {
  const h1 = headings(f.lines).filter(h => h.level === 1)
  const first = nonBlank(f.lines)[0]
  const re = new RegExp(`^# .+ ${suffix}$`)
  if (!first || !re.test(first.text.trim()))
    add(first?.no ?? 1, rule, `1行目は「# <名称> ${suffix}」にする`)
  for (const h of h1.slice(1)) add(h.no, rule, "H1 は1つだけにする")
}

/** H2 の並びと H1〜最初の H2 間の本文を検証する */
function checkH2(f, secs, expected, rule, add) {
  const actual = secs.slice(1).map(s => s.title)
  if (expected && actual.join("\n") !== expected.join("\n")) {
    add(
      secs[1]?.no ?? 1,
      rule,
      `H2 の並びが雛形と異なる（期待: ${expected.join(" / ")}、実際: ${actual.join(" / ") || "なし"}）`,
    )
  }
  for (const l of nonBlank(secs[0].lines).slice(1))
    add(l.no, rule, "H1 と最初の H2 の間に本文を置かない")
}

function checkLineLimit(f, limit, rule, add) {
  if (f.lines.length > limit)
    add(f.lines.length, rule, `${f.lines.length} 行（上限 ${limit} 行）`)
}

function checkSentence(text, no, add) {
  const n = [...text].length
  if (!text.endsWith("。") || text.split("。").length !== 2)
    add(no, "F-R09", "「。」で終わる1文にする")
  if (n > LIMIT.sentence)
    add(no, "F-R09", `${n} 文字（上限 ${LIMIT.sentence} 文字）`)
  if (ID_TOKEN.test(text))
    add(no, "F-R09", `他の ID（${ID_TOKEN.exec(text)[0]}）に言及しない`)
}

function checkRequirements(f, add) {
  checkH1(f, "要件定義書", "F-R01", add)
  const secs = sectionsByH2(f.lines)
  checkH2(f, secs, REQ_H2, "F-R02", add)
  checkLineLimit(f, LIMIT.reqLines, "F-R13", add)
  for (const h of headings(f.lines)) {
    if (
      h.level >= 3 &&
      !(h.level === 3 && ["2.1 対象", "2.2 対象外"].includes(h.text))
    ) {
      add(h.no, "F-R03", `使用できない見出し「${h.text}」`)
    }
  }
  for (const l of f.lines) {
    if (l.fence || isTableLine(l))
      add(l.no, "F-R04", "表・コードブロックは使わない")
  }
  const sec = t => secs.find(s => s.title === t)

  // 1. 目的
  const purpose = sec(REQ_H2[0])
  if (purpose) {
    const nb = nonBlank(purpose.lines)
    if (nb.length === 0) add(purpose.no, "F-R05", "目的が空")
    for (const l of nb)
      if (/^\s*([-*]|\d+\.)\s/.test(l.text))
        add(l.no, "F-R05", "目的は箇条書きにしない")
    const chars = nb.reduce((s, l) => s + [...l.text.trim()].length, 0)
    if (chars > LIMIT.purposeChars)
      add(
        purpose.no,
        "F-R05",
        `${chars} 文字（上限 ${LIMIT.purposeChars} 文字）`,
      )
  }

  // 2. スコープ
  const scope = sec(REQ_H2[1])
  if (scope) {
    const parts = new Map()
    let cur = null
    for (const l of scope.lines) {
      const m = !l.code && /^###\s+(.*?)\s*$/.exec(l.text)
      if (m) {
        cur = m[1]
        parts.set(cur, [])
      } else if (cur) parts.get(cur).push(l)
      else if (l.text.trim() !== "")
        add(l.no, "F-R06", "スコープ直下に本文を置かない（2.1／2.2 に書く）")
    }
    for (const name of ["2.1 対象", "2.2 対象外"]) {
      const ls = parts.get(name)
      if (!ls) {
        add(scope.no, "F-R06", `「### ${name}」がない`)
        continue
      }
      const nb = nonBlank(ls)
      if (nb.length === 0) add(scope.no, "F-R06", `「${name}」が空`)
      for (const l of nb) {
        if (!/^- \S/.test(l.text))
          add(l.no, "F-R06", "箇条書き（「- 」）のみで書く")
        const n = [...l.text.trim()].length
        if (n > LIMIT.scopeItem)
          add(l.no, "F-R06", `${n} 文字（上限 ${LIMIT.scopeItem} 文字）`)
      }
    }
  }

  // 3. 前提（参照先の実在・連鎖は check-structure が検証する）
  const pre = sec(REQ_H2[2])
  if (pre) {
    const nb = nonBlank(pre.lines)
    const isNone = nb.length === 1 && nb[0].text.trim() === "- なし"
    if (nb.length === 0)
      add(pre.no, "F-R07", "前提が空（ない場合は「- なし」）")
    if (!isNone) {
      for (const l of nb) {
        if (!/^- 前提: [a-z0-9-]+ — \S.*$/.test(l.text.trim()))
          add(l.no, "F-R07", "「- 前提: <spec名> — <理由>」の形式にする")
      }
    }
  }

  // 4. 機能要件 / 5. 非機能要件
  const ids = new Set()
  const parseReq = (secTitle, kind, min, max) => {
    const s = sec(secTitle)
    if (!s) return
    const nb = nonBlank(s.lines)
    if (kind === "NFR" && nb.length === 1 && nb[0].text.trim() === "- なし")
      return
    let count = 0
    for (const l of nb) {
      const m = new RegExp(`^- ${kind}-(\\d+): (.+)$`).exec(l.text.trim())
      if (!m) {
        add(l.no, "F-R08", `「- ${kind}-n: 〜。」の形式にする`)
        continue
      }
      count++
      if (Number(m[1]) !== count)
        add(l.no, "F-R08", `連番が不正（期待: ${kind}-${count}）`)
      ids.add(`${kind}-${m[1]}`)
      checkSentence(m[2], l.no, add)
      if (kind === "NFR" && !/\d/.test(m[2]))
        add(l.no, "F-R10", "数値を含めて定量的に書く")
    }
    if (count < min || count > max)
      add(s.no, "F-R08", `${kind} は ${min}〜${max} 件（実際: ${count} 件）`)
  }
  parseReq(REQ_H2[3], "FR", 1, LIMIT.fr)
  parseReq(REQ_H2[4], "NFR", 0, LIMIT.nfr)

  // 6. 受け入れ条件
  const ac = sec(REQ_H2[5])
  if (ac) {
    const covered = new Set()
    let count = 0
    for (const l of nonBlank(ac.lines)) {
      const m = /^- AC-(\d+) \(((?:N?FR)-\d+)\): (.+)$/.exec(l.text.trim())
      if (!m) {
        add(l.no, "F-R11", "「- AC-n (FR-m): 〜。」の形式にする")
        continue
      }
      count++
      if (Number(m[1]) !== count)
        add(l.no, "F-R11", `連番が不正（期待: AC-${count}）`)
      if (!ids.has(m[2]))
        add(l.no, "F-R11", `存在しない要件 ${m[2]} を参照している`)
      covered.add(m[2])
      // 受け入れ条件の tests/ パス参照は許可するため、ID 判定から除外する
      checkSentence(m[3].replace(/`tests\/[^`]+`/g, ""), l.no, add)
    }
    for (const id of [...ids].sort())
      if (!covered.has(id))
        add(ac.no, "F-R12", `${id} に対応する受け入れ条件がない`)
  }
}

function checkDesign(f, reqFile, add) {
  checkH1(f, "設計書", "F-D01", add)
  const secs = sectionsByH2(f.lines)
  checkH2(f, secs, DES_H2, "F-D02", add)
  checkLineLimit(f, LIMIT.designLines, "F-D10", add)
  const sec = t => secs.find(s => s.title === t)

  // H3/H4 の配置
  const items = sec(DES_H2[1])
  for (const s of secs) {
    for (const l of s.lines) {
      const m = !l.code && /^(#{3,6})\s/.exec(l.text)
      if (!m) continue
      if (m[1].length > 3) add(l.no, "F-D03", "H4 以下は使わない")
      else if (s !== items)
        add(l.no, "F-D03", "H3 は「2. 設計項目」の中だけに置く")
    }
  }

  // 1. 構成
  const comp = sec(DES_H2[0])
  if (comp)
    checkTable(comp, ["パス", "責務"], "F-D04", add, {
      allowNone: false,
      firstColCode: true,
    })

  // 2. 設計項目
  if (items) {
    const blocks = []
    for (const l of items.lines) {
      const isH3 = !l.code && /^###\s/.test(l.text)
      if (isH3) blocks.push({ head: l, body: [] })
      else if (blocks.length > 0) blocks.at(-1).body.push(l)
      else if (l.text.trim() !== "")
        add(l.no, "F-D03", "設計項目直下に本文を置かない（D-n の中に書く）")
    }
    if (blocks.length === 0)
      add(items.no, "F-D03", "設計項目（### D-n）が1つもない")
    const reqIds = new Set(requirementIds(reqFile))
    const covered = new Set()
    blocks.forEach((b, i) => {
      const m = /^### D-(\d+): (.+) \(((?:N?FR-\d+)(?:, N?FR-\d+)*)\)$/.exec(
        b.head.text.trim(),
      )
      if (!m) {
        add(b.head.no, "F-D03", "「### D-n: <題> (FR-m, NFR-k)」の形式にする")
      } else {
        if (Number(m[1]) !== i + 1)
          add(b.head.no, "F-D03", `連番が不正（期待: D-${i + 1}）`)
        for (const id of m[3].split(", ")) {
          covered.add(id)
          if (reqFile && !reqIds.has(id))
            add(b.head.no, "F-D07", `存在しない要件 ${id} を参照している`)
        }
      }
      if (!b.body.some(l => l.fence || isTableLine(l)))
        add(b.head.no, "F-D05", "コードブロックまたは表を1つ以上含める")
      const body = nonBlank(b.body)
      if (body.length > LIMIT.dLines)
        add(b.head.no, "F-D06", `${body.length} 行（上限 ${LIMIT.dLines} 行）`)
      for (const l of body) {
        if (!l.code && ID_TOKEN.test(l.text))
          add(
            l.no,
            "F-D08",
            `本文で ID（${ID_TOKEN.exec(l.text)[0]}）に言及しない`,
          )
      }
    })
    if (reqFile) {
      for (const id of reqIds)
        if (!covered.has(id))
          add(items.no, "F-D07", `${id} を参照する設計項目がない`)
    }
  }

  // 3. エラー処理
  const err = sec(DES_H2[2])
  if (err)
    checkTable(err, ["事象", "処理"], "F-D09", add, {
      allowNone: true,
      firstColCode: false,
    })
}

/** セクションが指定ヘッダの表（または「- なし」）だけで構成されているかを検証する */
function checkTable(s, header, rule, add, { allowNone, firstColCode }) {
  const nb = nonBlank(s.lines)
  if (allowNone && nb.length === 1 && nb[0].text.trim() === "- なし") return
  if (nb.length < 3) {
    add(s.no, rule, `「| ${header.join(" | ")} |」の表（1行以上）で書く`)
    return
  }
  for (const l of nb)
    if (!isTableLine(l)) add(l.no, rule, "表以外の行を置かない")
  if (splitRow(nb[0].text).join("|") !== header.join("|"))
    add(nb[0].no, rule, `表の見出しは「| ${header.join(" | ")} |」にする`)
  for (const l of nb.slice(2)) {
    if (!isTableLine(l)) continue
    const cells = splitRow(l.text)
    if (cells.length !== header.length)
      add(l.no, rule, `列数は ${header.length} にする`)
    if (firstColCode && !/^`[^`]+`$/.test(cells[0]))
      add(l.no, rule, "パス列はバッククォートで囲む")
  }
}

const UI_PATTERN = /\.(?:tsx|astro|css)\b|コンポーネント|画面|ページ|\bUI\b/

function checkTasks(f, desFile, add) {
  checkH1(f, "タスク一覧", "F-T01", add)
  const secs = sectionsByH2(f.lines)
  checkH2(f, secs, null, "F-T02", add)
  checkLineLimit(f, LIMIT.tasksLines, "F-T10", add)
  for (const h of headings(f.lines))
    if (h.level >= 3) add(h.no, "F-T03", `使用できない見出し「${h.text}」`)

  const phases = secs.slice(1)
  if (phases.length === 0) add(1, "F-T02", "Phase が1つもない")
  if (phases.length > LIMIT.phases)
    add(
      phases[LIMIT.phases].no,
      "F-T02",
      `Phase は ${LIMIT.phases} 個以内（実際: ${phases.length} 個）`,
    )

  const assigned = new Map() // D → Phase 見出し行
  const dIds = new Set(designIds(desFile))
  let total = 0
  phases.forEach((s, pi) => {
    const p = pi + 1
    const hm = /^Phase (\d+): \S.*$/.exec(s.title)
    if (!hm) add(s.no, "F-T02", "「## Phase n: <名>」の形式にする")
    else if (Number(hm[1]) !== p)
      add(s.no, "F-T02", `連番が不正（期待: Phase ${p}）`)

    let kinds = ""
    let taskCount = 0
    let uiText = s.title
    let hasE2E = false
    for (const l of nonBlank(s.lines)) {
      const t = l.text
      let m
      if ((m = /^- 対応: (D-\d+(?:, D-\d+)*)$/.exec(t))) {
        kinds += "R"
        for (const id of m[1].split(", ")) {
          if (desFile && !dIds.has(id))
            add(l.no, "F-T08", `存在しない設計項目 ${id} を参照している`)
          if (assigned.has(id))
            add(l.no, "F-T08", `${id} は複数の Phase に割り当てられている`)
          assigned.set(id, l.no)
        }
      } else if ((m = /^- \[[ x]\] T-(\d+)\.(\d+): (\S.*)$/.exec(t))) {
        kinds += "T"
        taskCount++
        total++
        uiText += "\n" + m[3]
        if (Number(m[1]) !== p || Number(m[2]) !== taskCount)
          add(l.no, "F-T04", `連番が不正（期待: T-${p}.${taskCount}）`)
        const n = [...m[3]].length
        if (n > LIMIT.sentence)
          add(l.no, "F-T04", `${n} 文字（上限 ${LIMIT.sentence} 文字）`)
      } else if ((m = /^- 検証: (.+)$/.exec(t))) {
        kinds += "V"
        if (!/`[^`]+`/.test(m[1]))
          add(l.no, "F-T05", "コマンドまたはテストをバッククォートで示す")
      } else if (/^- E2E: /.test(t)) {
        kinds += "E"
        hasE2E = true
        if (!/^- E2E: `tests\/e2e\/[\w./-]+\.spec\.ts` \S.* → \S.*$/.test(t))
          add(
            l.no,
            "F-T06",
            "「- E2E: `tests/e2e/<名>.spec.ts` <操作> → <期待結果>」の形式にする",
          )
      } else {
        kinds += "X"
        add(
          l.no,
          "F-T07",
          "雛形にない行（対応／タスク／検証／E2E のみ記述できる）",
        )
      }
    }
    if (!/^RT+VE*$/.test(kinds.replace(/X/g, "")))
      add(
        s.no,
        "F-T07",
        "行の並びは「- 対応:」→ タスク → 「- 検証:」→（「- E2E:」）にする",
      )
    if ((kinds.match(/R/g) ?? []).length !== 1)
      add(s.no, "F-T08", "「- 対応:」行をちょうど1つ置く")
    if ((kinds.match(/V/g) ?? []).length !== 1)
      add(s.no, "F-T05", "「- 検証:」行をちょうど1つ置く")
    if (taskCount < 1 || taskCount > LIMIT.tasksPerPhase)
      add(
        s.no,
        "F-T04",
        `タスクは 1〜${LIMIT.tasksPerPhase} 件（実際: ${taskCount} 件）`,
      )
    if (UI_PATTERN.test(uiText) && !hasE2E)
      add(s.no, "F-T06", "UI に関わる Phase に「- E2E:」行がない")
  })
  if (total > LIMIT.tasksTotal)
    add(
      1,
      "F-T09",
      `タスクは合計 ${LIMIT.tasksTotal} 件以内（実際: ${total} 件）`,
    )
  if (desFile) {
    for (const id of [...dIds].filter(d => !assigned.has(d)))
      add(1, "F-T08", `${id} がどの Phase にも割り当てられていない`)
  }
}

export function check(ctx) {
  const out = []
  for (const spec of ctx.specs) {
    if (!ctx.targets.has(spec.name)) continue
    const { requirements: r, design: d, tasks: t } = spec.files
    const adder = f => (no, rule, msg) =>
      out.push(finding(f.rel, no, rule, msg))
    if (r) checkRequirements(r, adder(r))
    if (d) checkDesign(d, r, adder(d))
    if (t) checkTasks(t, d, adder(t))
  }
  return out
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = runCli([{ title, rules, check }])
}
