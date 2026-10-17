/**
 * 表現チェック: 規定ルールにそぐわない語・表現を検出する。
 *
 * コードブロック内は対象外（W008 の重複検出も同様）。ただし mermaid の図は
 * 設計書の本文とみなし、W008 以外のルールを適用する（図の行は設計上重複しうるため）。
 *
 * architecture（docs/architecture.md・くくりの文書）には、W001・W002・W004・W005・W007 に加えて
 * W009〜W014 を適用する。PoC の README には W002・W007 だけを適用する（手順と結果を書く文書のため）。
 */
import { pathToFileURL } from "node:url"
import { parseArchitecture } from "./docs-model.mjs"
import { finding, isTableLine, runCli, splitRow } from "./lib.mjs"

export const title = "表現チェック（check-wording）"

export const rules = {
  W001: "進捗・先送りを示す語（TODO／TBD／検討中／未定／未決／今後／将来／後日／暫定／予定／未実装／実装済／実装状況／対応済／完了済 等）を書かない。進捗は tasks.md のチェックボックスのみで表す",
  W002: "曖昧語（など／等／適宜／必要に応じ／可能であれば／できれば／基本的に／おおよそ／十分／適切に／柔軟に／簡単に）を書かない。対象・条件・数値を列挙して確定させる",
  W003: "requirements.md に実装の詳細（バッククォート、ファイルパス、拡張子、関数呼び出し表記）を書かない。受け入れ条件行の `tests/` パス参照のみ許可する",
  W004: "requirements.md・design.md に経緯・比較の語（以前／従来／これまで／現状／現在は／かつて／変更前／変更後／旧仕様／既存の実装）を書かない。確定した仕様のみを書く",
  W005: "仕様書ファイル名（requirements.md／design.md／tasks.md）に言及しない。役割の説明は SKILL.md の責務であり、対応付けは ID（FR／D／T）で行う",
  W006: "tasks.md に判断を要する語（検討／判断／要確認／決定／決める／相談）を書かない。判断は requirements.md・design.md で確定させる",
  W007: "絵文字・状態記号（✅ ⬜ 🚧 等）を書かない",
  W008: "24文字以上の同一行を、同一ファイル内・同一 spec の3ファイル間で重複させない（ID 接頭辞は除いて比較する）",
  W009: "architecture に経緯・検証・時点の語（採用しなかった／却下／代替案／当初／最初は／その後／検証した／検証済／未検証／レビュー／初期値／現時点／PoC、日付 YYYY-MM・YYYY年）を書かない。確定した構造と制約だけを書く（根拠の poc/<テーマ> は根拠列にだけ書ける）",
  W010: "architecture の地の文・箇条書きの各行は「。」で終わる1文（120文字以内）にする。文を書く表の列（責務・信頼する前提・検証手段・理由）のセルは、述語（動詞・形容詞・助動詞の終止形）で終わり、体言止めにしない",
  W011: "architecture に指示語・代名詞（これ／それ／あれ／ここ／そこ／同様／上記／下記／前述／後述／当該）を書かない。指す対象を名前で書く",
  W012: "architecture の地の文・箇条書きの各文に、主語を示す助詞（は／が／も）のいずれかを含める（主語の省略の近似検出）",
  W013: "architecture に spec 名と poc/<テーマ> を書けるのは、構成要素表の実装spec 列と、技術基盤・横断的制約の根拠列だけにする",
  W014: "architecture の 24 文字以上の同一行を、architecture 内、および architecture と spec の間で重複させない（ID 接頭辞は除いて比較する）",
}

const RE = {
  W001: /TODO|FIXME|TBD|検討中|要検討|未定|未決|今後|将来|後日|次セッション|暫定|仮置き|予定|未実装|実装済|実装状況|対応済|完了済/,
  W002: /など|適宜|必要に応じ|可能であれば|できれば|基本的に|おおよそ|十分|適切に|柔軟に|簡単に|等(?=[、。)）\s]|$)/,
  W004: /以前|従来|これまで|現状|現在は|かつて|変更前|変更後|旧仕様|既存の実装/,
  W005: /\b(?:requirements|design|tasks)\.md\b/,
  W006: /検討|判断|要確認|決定|決める|相談/,
  W007: /\p{Extended_Pictographic}/u,
}

const W009_RE =
  /採用しなかった|却下|代替案|当初|最初は|その後|検証した|検証済|未検証|レビュー|初期値|現時点|PoC|\d{4}-\d{2}(?:-\d{2})?|\d{4}年/
const W011_RE =
  /これ|それ(?!ぞれ)|あれ(?!ば)|ここ|そこ|同様|上記|下記|前述|後述|当該/
const SENTENCE_END_RE = /[るうくぐすつぬぶむいだたん]$/

const LABEL = {
  W001: "進捗・先送りの語",
  W002: "曖昧語",
  W005: "仕様書ファイル名への言及",
  W007: "絵文字・状態記号",
}

const W003_PATTERNS = [
  /`/,
  /\b(?:src|tests|lib|hack|specs|public)\/[\w./-]+/,
  /\.(?:tsx?|mjs|astro|css|json|ya?ml)\b/,
  /\b\w+\(\)/,
]

// 重複比較用の正規化: 箇条書き記号・チェックボックス・ID 接頭辞を除去する
const normalize = (text) =>
  text
    .trim()
    .replace(/^[-*]\s*(\[[ x]\]\s*)?/, "")
    .replace(/^(?:[A-Z]+-[\d.]+(?:\s*\([^)]*\))?:\s*)/, "")
    .replace(/^#+\s*/, "")
    .trim()

function checkSpecs(ctx) {
  const out = []
  for (const spec of ctx.specs) {
    if (!ctx.targets.has(spec.name)) continue
    const seen = new Map() // 正規化後の行 → 最初の出現
    for (const kind of ["requirements", "design", "tasks"]) {
      const f = spec.files[kind]
      if (!f) continue
      const add = (no, rule, msg) => out.push(finding(f.rel, no, rule, msg))
      for (const l of f.lines) {
        const inDiagram = l.code && l.lang === "mermaid" && !l.fence
        if (l.code && !inDiagram) continue
        const t = l.text
        for (const rule of ["W001", "W002", "W005", "W007"]) {
          const m = RE[rule].exec(t)
          if (m) add(l.no, rule, `「${m[0]}」は使用不可（${LABEL[rule]}）`)
        }
        if (kind !== "tasks") {
          const m = RE.W004.exec(t)
          if (m) add(l.no, "W004", `「${m[0]}」は使用不可（経緯・比較の語）`)
        }
        if (kind === "tasks") {
          const m = RE.W006.exec(t)
          if (m)
            add(
              l.no,
              "W006",
              `「${m[0]}」は使用不可（判断は requirements／design で確定させる）`,
            )
        }
        if (kind === "requirements" && !inDiagram) {
          // 受け入れ条件行の tests/ パス参照は許可する
          const body = /^- AC-\d+ /.test(t)
            ? t.replace(/`tests\/[^`]+`/g, "")
            : t
          const hit = W003_PATTERNS.map((re) => re.exec(body)).find(Boolean)
          if (hit)
            add(l.no, "W003", `「${hit[0]}」: 実装の詳細は design.md に書く`)
        }
        // 重複検出（表の区切り行と図の行は除く）
        if (inDiagram) continue
        if (/^\s*\|[\s:|-]+\|\s*$/.test(t)) continue
        const key = normalize(t)
        if ([...key].length < 24) continue
        const first = seen.get(key)
        if (first) add(l.no, "W008", `重複行（初出: ${first.rel}:${first.no}）`)
        else seen.set(key, { rel: f.rel, no: l.no })
      }
    }
  }
  return out
}

const escapeRe = (x) => x.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")

/** 表の行の列位置 → 「名称・値の列」（W013 の免除列）。実装spec と根拠の列 */
const SPEC_REF_COLUMNS = {
  "2. 構成要素": [3],
  "7. 信頼と検証": [3],
  "8. 技術基盤": [3],
  "9. 横断的制約": [2],
}
/** 文を書く表の列（W010 の終止形検査） */
const SENTENCE_COLUMNS = {
  "2. 構成要素": [2],
  "7. 信頼と検証": [1, 2],
  "8. 技術基盤": [2],
}

/** architecture（全体とくくりの文書）の語彙・文体・参照・重複 */
function checkArchitecture(ctx) {
  const out = []
  const arch = ctx.docs.architecture
  if (!ctx.targetArch) return out
  const files = (parseArchitecture(arch)?.docs ?? []).map((d) => d.file)
  if (files.length === 0) return out

  const specNames = ctx.specs.map((s) => s.name)
  const refRe = new RegExp(
    `(?<![A-Za-z0-9_-])(?:${specNames.length > 0 ? specNames.map(escapeRe).join("|") + "|" : ""}poc/[a-z0-9-]+)(?![A-Za-z0-9_-])`,
  )
  // W014 の突合先: spec の本文の行（コード・図を除く）
  const specLines = new Map()
  for (const spec of ctx.specs)
    for (const f of Object.values(spec.files))
      for (const l of f.lines) {
        if (l.code || /^\s*\|[\s:|-]+\|\s*$/.test(l.text)) continue
        const key = normalize(l.text)
        if ([...key].length >= 24 && !specLines.has(key))
          specLines.set(key, { rel: f.rel, no: l.no })
      }
  const seen = new Map()

  for (const f of files) {
    const add = (no, rule, msg) => out.push(finding(f.rel, no, rule, msg))
    // 表の見出し行（次の行が区切り行の表の行）
    const headerNos = new Set()
    f.lines.forEach((x, i) => {
      const nx = f.lines[i + 1]
      if (
        !x.code &&
        isTableLine(x) &&
        nx &&
        !nx.code &&
        /^\s*\|[\s:|-]+\|\s*$/.test(nx.text)
      )
        headerNos.add(x.no)
    })
    let h2 = null
    for (const l of f.lines) {
      const inDiagram = l.code && l.lang === "mermaid" && !l.fence
      if (l.code && !inDiagram) continue
      const t = l.text
      const hm = !l.code && /^##\s+(.*?)\s*$/.exec(t)
      if (hm) h2 = hm[1]
      const isHeading = !l.code && /^#{1,6}\s/.test(t)
      const isTable = !l.code && isTableLine(l)
      const isSep = isTable && /^\s*\|[\s:|-]+\|\s*$/.test(t)

      // 表は、実装spec・根拠の列を除いた文字列を W009・W013 の対象にする
      let scan = t
      let cells = null
      if (isTable && !isSep) {
        cells = splitRow(t)
        const exempt = SPEC_REF_COLUMNS[h2] ?? []
        scan = cells.map((c, i) => (exempt.includes(i) ? "" : c)).join(" | ")
      }
      if (isSep) continue
      for (const rule of ["W001", "W002", "W005", "W007"]) {
        const m = RE[rule].exec(t)
        if (m) add(l.no, rule, `「${m[0]}」は使用不可（${LABEL[rule]}）`)
      }
      {
        const m = RE.W004.exec(t)
        if (m) add(l.no, "W004", `「${m[0]}」は使用不可（経緯・比較の語）`)
      }
      {
        const m = W009_RE.exec(scan)
        if (m)
          add(l.no, "W009", `「${m[0]}」は使用不可（経緯・検証・時点の語）`)
      }
      {
        const m = W011_RE.exec(scan)
        if (m)
          add(l.no, "W011", `「${m[0]}」は使用不可（指す対象を名前で書く）`)
      }
      {
        const m = refRe.exec(scan)
        if (m)
          add(l.no, "W013", `「${m[0]}」は実装spec 列・根拠列以外に書かない`)
      }

      // W010・W012: 文の形
      if (isTable) {
        const cols = SENTENCE_COLUMNS[h2] ?? []
        if (cells && !headerNos.has(l.no))
          for (const i of cols) {
            const c = cells[i]
            if (c && !SENTENCE_END_RE.test(c))
              add(
                l.no,
                "W010",
                `「${c}」は述語で終わる文にする（体言止めにしない）`,
              )
          }
      } else if (!isHeading && !inDiagram) {
        const body = t.trim()
        if (body === "" || NONE_LINE.test(body) || /^- 関与: /.test(body))
          continue
        const text = body.replace(/^- /, "")
        const n = [...text].length
        if (!text.endsWith("。") || text.split("。").length !== 2)
          add(l.no, "W010", "各行は「。」で終わる1文にする")
        else if (n > 120) add(l.no, "W010", `${n} 文字（上限 120 文字）`)
        if (!/[はがも]/.test(text))
          add(l.no, "W012", "主語を示す助詞（は／が／も）がない。主語を書く")
      }

      // W014: 重複
      if (!inDiagram && !isSep) {
        const key = normalize(t)
        if ([...key].length >= 24) {
          const first = specLines.get(key) ?? seen.get(key)
          if (first)
            add(l.no, "W014", `重複行（初出: ${first.rel}:${first.no}）`)
          else seen.set(key, { rel: f.rel, no: l.no })
        }
      }
    }
  }
  return out
}

const NONE_LINE = /^- なし$/

/** PoC の README: W002・W007 だけ */
function checkPoc(ctx) {
  const out = []
  for (const poc of ctx.docs.pocs) {
    if (!ctx.targetPocs.has(`poc/${poc.name}`) || !poc.readme) continue
    for (const l of poc.readme.lines) {
      if (l.code) continue
      for (const rule of ["W002", "W007"]) {
        const m = RE[rule].exec(l.text)
        if (m)
          out.push(
            finding(
              poc.readme.rel,
              l.no,
              rule,
              `「${m[0]}」は使用不可（${LABEL[rule]}）`,
            ),
          )
      }
    }
  }
  return out
}

export function check(ctx) {
  return [...checkSpecs(ctx), ...checkArchitecture(ctx), ...checkPoc(ctx)]
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = await runCli([{ title, rules, check }])
}
