/**
 * PoC 体裁チェック: poc/<テーマ>/README.md が雛形どおりであることを検証する。
 *
 * - 章立て（結論・反映先・制約値・検証項目・手順と結果）と各章の固定形
 * - 結論・反映先・検証項目の結果の整合（状態を成果物から導出できる形にする）
 * - README の行数上限。詳細（手順・ログ）は README の外に置き、リンクだけを書く
 * 配置・反映先 spec の実在・残留と滞留は check-structure（S 系）が担う。
 */
import fs from "node:fs"
import path from "node:path"
import { pathToFileURL } from "node:url"
import { POC_CHAPTERS, POC_TABLES, parsePoc } from "./docs-model.mjs"
import {
  finding,
  headings,
  isTableLine,
  nonBlank,
  parseTable,
  runCli,
} from "./lib.mjs"

export const title = "PoC 体裁チェック（check-poc）"

const LIMIT = { conclusionChars: 200 }

const len = (s) => [...s].length

export const rules = {
  "F-P01":
    "README.md の1行目は「# <テーマ> PoC」の H1 とし、H1 は1つだけにする",
  "F-P02": `README.md の H2 は「${POC_CHAPTERS.join("」「")}」をこの順で過不足なく置き、H1 と最初の H2 の間に本文を置かない`,
  "F-P03": `結論は「- なし」か、箇条書き・表を使わず「。」で終わる行だけの ${LIMIT.conclusionChars} 文字以内の地の文で書く`,
  "F-P04":
    "反映先は「- なし」か「- <spec名>」の1行だけで書く（1つの PoC の反映先は1件）",
  "F-P05":
    "制約値は「- なし」か、「| 項目 | 値 |」の表だけで書き、値は数値を含む",
  "F-P06":
    "検証項目は「| 仮説 | 合格基準 | 結果 |」の表だけで書く。1行以上、全セルを埋め、結果は「合」「否」「-」のいずれかにする",
  "F-P07":
    "手順と結果は「- [名前](README.md からの相対パス)」の箇条書きを1件以上置き、リンク先が実在する（親ディレクトリ・URL は不可）",
  "F-P08":
    "結論が「- なし」でないことと、検証項目の結果がすべて「合」か「否」であることは同値にする。反映先を書くときは結論がある",
  "F-P09": "README.md は設定の行数（poc.maxReadmeLines。初期 100）以内にする",
}

const NONE = /^- なし$/

export function check(ctx) {
  const out = []
  const cfg = ctx.config.poc
  for (const poc of ctx.docs.pocs) {
    if (!ctx.targetPocs.has(`poc/${poc.name}`) || !poc.readme) continue
    const f = poc.readme
    const add = (no, rule, msg) => out.push(finding(f.rel, no, rule, msg))
    const m = parsePoc(poc)

    // F-P01・F-P02
    const h1s = headings(f.lines).filter((h) => h.level === 1)
    if (!/^# \S.* PoC$/.test(f.lines[0]?.text ?? "") || h1s.length !== 1)
      add(1, "F-P01", "1行目は「# <テーマ> PoC」の H1 にし、H1 は1つだけにする")
    const h2s = m.secs.filter((s) => s.title !== null).map((s) => s.title)
    if (h2s.join("\n") !== POC_CHAPTERS.join("\n"))
      add(
        1,
        "F-P02",
        `H2 は「${POC_CHAPTERS.join("」「")}」をこの順で過不足なく置く（実際: ${h2s.join("、") || "なし"}）`,
      )
    const pre = nonBlank(m.secs[0].lines).filter((l) => !/^#\s/.test(l.text))
    if (pre.length > 0)
      add(pre[0].no, "F-P02", "H1 と最初の H2 の間に本文を置かない")

    // F-P03: 結論
    const s1 = m.sec("1. 結論")
    if (s1) {
      if (!m.conclusion.none) {
        const body = m.conclusion.lines
        if (body.length === 0)
          add(s1.no, "F-P03", "結論が空（未結論は「- なし」）")
        for (const l of body) {
          if (/^\s*([-*]|\d+\.)\s|^\s*[|#]|^\s*```/.test(l.text))
            add(
              l.no,
              "F-P03",
              "結論に箇条書き・表・コードを使わない（未結論は「- なし」だけ）",
            )
          else if (!l.text.trim().endsWith("。"))
            add(l.no, "F-P03", "結論の各行は「。」で終わる")
        }
        if (len(m.conclusion.text) > LIMIT.conclusionChars)
          add(
            s1.no,
            "F-P03",
            `${len(m.conclusion.text)} 文字（上限 ${LIMIT.conclusionChars} 文字）`,
          )
      }
    }

    // F-P04: 反映先
    const s2 = m.sec("2. 反映先")
    if (s2) {
      const body = m.target.lines
      const ok =
        body.length === 1 &&
        (NONE.test(body[0].text.trim()) ||
          /^- [a-z0-9][a-z0-9-]*$/.test(body[0].text.trim()))
      if (!ok)
        add(s2.no, "F-P04", "反映先は「- なし」か「- <spec名>」の1行だけにする")
    }

    // F-P05: 制約値
    const s3 = m.sec("3. 制約値")
    if (s3) {
      const body = nonBlank(s3.lines)
      if (!(body.length === 1 && NONE.test(body[0].text.trim()))) {
        const t = m.constraints
        if (
          !t ||
          t.header.join("\n") !== POC_TABLES["3. 制約値"].join("\n") ||
          !t.separator
        )
          add(s3.no, "F-P05", "「- なし」か「| 項目 | 値 |」の表にする")
        else {
          if (t.rows.length === 0)
            add(t.headerNo, "F-P05", "表にデータ行がない")
          for (const r of t.rows)
            if (
              r.cells.length !== 2 ||
              r.cells.some((c) => c === "") ||
              !/\d/.test(r.cells[1])
            )
              add(r.no, "F-P05", "2列とも埋め、値は数値を含める")
        }
        const extra = nonBlank(s3.lines).filter((l) => !isTableLine(l))
        if (extra.length > 0) add(extra[0].no, "F-P05", "表以外の行を置かない")
      }
    }

    // F-P06: 検証項目
    const s4 = m.sec("4. 検証項目")
    if (s4) {
      const t = m.items
      if (
        !t ||
        t.header.join("\n") !== POC_TABLES["4. 検証項目"].join("\n") ||
        !t.separator
      )
        add(s4.no, "F-P06", "「| 仮説 | 合格基準 | 結果 |」の表にする")
      else {
        if (t.rows.length === 0)
          add(t.headerNo, "F-P06", "検証項目を1行以上置く")
        for (const r of t.rows) {
          if (r.cells.length !== 3 || r.cells.some((c) => c === ""))
            add(r.no, "F-P06", "3列とも埋める")
          else if (!["合", "否", "-"].includes(r.cells[2]))
            add(
              r.no,
              "F-P06",
              `結果は「合」「否」「-」のいずれか（実際: ${r.cells[2]}）`,
            )
        }
      }
      const extra = nonBlank(s4.lines).filter((l) => !isTableLine(l))
      if (extra.length > 0) add(extra[0].no, "F-P06", "表以外の行を置かない")
    }

    // F-P07: 手順と結果
    const s5 = m.sec("5. 手順と結果")
    if (s5) {
      const body = nonBlank(s5.lines)
      if (body.length === 0) add(s5.no, "F-P07", "リンクを1件以上置く")
      for (const l of body) {
        const lm = /^- \[([^\]]+)\]\(([^)]+)\)$/.exec(l.text.trim())
        if (!lm) {
          add(l.no, "F-P07", "「- [名前](相対パス)」の形式にする")
          continue
        }
        const target = lm[2].split("#")[0]
        if (
          /^[a-z]+:\/\//i.test(target) ||
          target.startsWith("/") ||
          target.split("/").includes("..")
        )
          add(
            l.no,
            "F-P07",
            "リンク先は README.md と同じディレクトリ以下の相対パスにする",
          )
        else if (!fs.existsSync(path.join(poc.dir, target)))
          add(l.no, "F-P07", `リンク先 ${lm[2]} が存在しない`)
      }
    }

    // F-P08: 整合
    const resultsFilled =
      m.results.length > 0 && m.results.every((x) => x === "合" || x === "否")
    const concluded = !m.conclusion.none
    if (s1 && m.items && concluded !== resultsFilled)
      add(
        s1?.no ?? 1,
        "F-P08",
        concluded
          ? "結論があるのに、検証項目の結果に「-」が残っている（結論は全項目の結果が出てから書く）"
          : "検証項目の結果がすべて出ているのに、結論が「- なし」のまま",
      )
    if (m.target.name && !concluded)
      add(m.target.no, "F-P08", "結論が「- なし」のまま反映先を書かない")

    // F-P09
    if (f.lines.length > cfg.maxReadmeLines)
      add(
        1,
        "F-P09",
        `${f.lines.length} 行（上限 ${cfg.maxReadmeLines} 行）。詳細は README の外のファイルへ移し、リンクだけを書く`,
      )
  }
  return out
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = await runCli([{ title, rules, check }])
}
