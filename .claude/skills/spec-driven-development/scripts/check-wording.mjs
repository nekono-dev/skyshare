/**
 * 表現チェック: 規定ルールにそぐわない語・表現を検出する。
 *
 * コードブロック内は対象外（W008 の重複検出も同様）。
 */
import { pathToFileURL } from "node:url"
import { finding, runCli } from "./lib.mjs"

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
}

const RE = {
  W001: /TODO|FIXME|TBD|検討中|要検討|未定|未決|今後|将来|後日|次セッション|暫定|仮置き|予定|未実装|実装済|実装状況|対応済|完了済/,
  W002: /など|適宜|必要に応じ|可能であれば|できれば|基本的に|おおよそ|十分|適切に|柔軟に|簡単に|等(?=[、。)）\s]|$)/,
  W004: /以前|従来|これまで|現状|現在は|かつて|変更前|変更後|旧仕様|既存の実装/,
  W005: /\b(?:requirements|design|tasks)\.md\b/,
  W006: /検討|判断|要確認|決定|決める|相談/,
  W007: /\p{Extended_Pictographic}/u,
}

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
const normalize = text =>
  text
    .trim()
    .replace(/^[-*]\s*(\[[ x]\]\s*)?/, "")
    .replace(/^(?:[A-Z]+-[\d.]+(?:\s*\([^)]*\))?:\s*)/, "")
    .replace(/^#+\s*/, "")
    .trim()

export function check(ctx) {
  const out = []
  for (const spec of ctx.specs) {
    if (!ctx.targets.has(spec.name)) continue
    const seen = new Map() // 正規化後の行 → 最初の出現
    for (const kind of ["requirements", "design", "tasks"]) {
      const f = spec.files[kind]
      if (!f) continue
      const add = (no, rule, msg) => out.push(finding(f.rel, no, rule, msg))
      for (const l of f.lines) {
        if (l.code) continue
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
        if (kind === "requirements") {
          // 受け入れ条件行の tests/ パス参照は許可する
          const body = /^- AC-\d+ /.test(t)
            ? t.replace(/`tests\/[^`]+`/g, "")
            : t
          const hit = W003_PATTERNS.map(re => re.exec(body)).find(Boolean)
          if (hit)
            add(l.no, "W003", `「${hit[0]}」: 実装の詳細は design.md に書く`)
        }
        // 重複検出（表の区切り行は除く）
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

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = runCli([{ title, rules, check }])
}
