/**
 * architecture・PoC・設定・補助コマンドの自己テスト（selftest.mjs から読み込まれる）。
 *
 * - 雛形（architecture.md・architecture-grouped/・poc-readme.md）が、spec を持つリポジトリでチェックを通過すること
 * - 雛形を1か所ずつ崩したとき、対応するルールが検出されること（docCases。全ルール ID の網羅は selftest.mjs が強制する）
 * - 設定ファイル・--status・--retarget-poc・--check-poc-committed の挙動
 */
import { test } from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { spawnSync } from "node:child_process"
import {
  checkAll,
  depsProblem,
  makeRoot,
  rulesOf,
  run,
  runFull,
  templates,
} from "./selftest-lib.mjs"

const read = (f) => fs.readFileSync(path.join(templates, f), "utf8")

/** architecture の雛形が参照する spec 名（雛形のとおり設計済みの spec として作る） */
export const ARCH_SPECS = [
  "notification-badge",
  "notification-api",
  "delivery-worker",
]

const ARCH = "../docs/architecture.md"
const POC = "../poc/storage-cost/README.md"
const DEFAULTS = {
  [ARCH]: () => read("architecture.md"),
  [POC]: () => read("poc-readme.md"),
  "../poc/storage-cost/measure.md": () => "測定値\n",
}

/** 雛形の既定の配置に edits を重ねる。edits のキーが既定の配置先なら、雛形に対する編集になる */
function layer(defaults, edits) {
  const out = {}
  for (const [k, def] of Object.entries(defaults))
    out[k] =
      k in edits ? (edits[k] === null ? null : () => edits[k](def())) : def
  for (const [k, v] of Object.entries(edits)) if (!(k in defaults)) out[k] = v
  return out
}

/** architecture と PoC の雛形を配置した edits */
export const arch = (edits = {}) => layer(DEFAULTS, edits)

/** くくり別の architecture（全体 + くくりの文書 3 件。内部の構成要素 8 個）の雛形が参照する spec 名 */
export const GROUPED_SPECS = [
  "publish-api",
  "recipient-registry",
  "delivery-worker",
  "notification-store",
  "read-position",
  "notification-badge",
  "notification-api",
  "notification-list",
]

const GDIR = path.join(templates, "architecture-grouped")
const G = {
  root: "../docs/architecture.md",
  publish: "../docs/architecture/publish.md",
  store: "../docs/architecture/store.md",
  display: "../docs/architecture/display.md",
}
const gread = (f) => fs.readFileSync(path.join(GDIR, f), "utf8")
const GROUPED_DEFAULTS = {
  [G.root]: () => gread("architecture.md"),
  [G.publish]: () => gread("publish.md"),
  [G.store]: () => gread("store.md"),
  [G.display]: () => gread("display.md"),
}
/** くくり別の architecture の雛形を配置した edits */
export const grouped = (edits = {}) => layer(GROUPED_DEFAULTS, edits)

const a = (fn) => arch({ [ARCH]: fn })
const p = (fn) => arch({ [POC]: fn })

const rep = (from, to) => (t) => {
  assert.ok(t.includes(from), `置換元が雛形にない: ${from}`)
  return t.replace(from, to)
}
const sub = (re, to) => (t) => {
  assert.ok(re.test(t), `置換元が雛形にない: ${re}`)
  return t.replace(re, to)
}

/** 1 つ目の機能（通知の発行）の本文を雛形から取り出す */
const FIRST_FUNCTION = read("architecture.md")
  .match(/### 通知の発行\n\n([\s\S]*?)(?=### 未読件数の表示)/)[1]
  .trimEnd()
const PART = "../docs/architecture/notification-publish.md"

const gr = (file, fn) => grouped({ [file]: fn })
const cfgOf = (obj) => ({ "../.spec-driven.json": () => JSON.stringify(obj) })

/** 検証中の PoC（結論なし・結果なし・反映先なし） */
const pendingPoc = () =>
  read("poc-readme.md")
    .replace("1 宛先あたり 1000 件の保管は、無料枠の範囲に収まる。", "- なし")
    .replace("- delivery-worker", "- なし")
    .replace("| 合   |", "| -    |")

// [説明, edits, 期待ルール, 追加 spec 名]
export const docCases = [
  [
    "設計書の図で円柱を使う",
    {
      "sample/design.md": rep(
        '  unreadCount --> ext_agent["Agent"]',
        '  unreadCount --> ext_agent[("Agent")]',
      ),
    },
    "G015",
  ],
  ["設計済み spec が閾値以上で architecture.md がない", {}, "S010", ARCH_SPECS],
  [
    "全体が 1 ファイルの形式のまま docs/architecture/ にファイルがある（機能ごとの旧形式）",
    arch({ [PART]: () => `# 通知の発行\n\n${FIRST_FUNCTION}\n` }),
    "S011",
    ARCH_SPECS,
  ],
  [
    "くくりの文書のファイル名が不正",
    grouped({ "../docs/architecture/Bad_Name.md": () => "# x\n" }),
    "S011",
    GROUPED_SPECS,
  ],
  [
    "くくりの文書が構成要素表からリンクされていない",
    grouped({
      "../docs/architecture/extra.md": () => "# 追加 アーキテクチャ\n",
    }),
    "S011",
    GROUPED_SPECS,
  ],
  [
    "設計済み spec が実装spec にない",
    arch(),
    "S012",
    [...ARCH_SPECS, "extra-spec"],
  ],
  [
    "根拠の spec が存在しない",
    a(sub(/delivery-worker {2}\|/, "ghost-spec     |")),
    "S013",
    ARCH_SPECS,
  ],
  ["PoC に README.md がない", arch({ [POC]: null }), "S014", ARCH_SPECS],
  [
    "PoC の反映先 spec が存在しない",
    p(rep("- delivery-worker", "- ghost-spec")),
    "S015",
    ARCH_SPECS,
  ],
  [
    "反映先 spec が完了した PoC が残っている",
    arch({ "delivery-worker/tasks.md": (t) => t.replaceAll("- [ ]", "- [x]") }),
    "S016",
    ARCH_SPECS,
  ],
  [
    "反映先 spec が完了した PoC を根拠に持つ行が残っている",
    arch({ "delivery-worker/tasks.md": (t) => t.replaceAll("- [ ]", "- [x]") }),
    "S018",
    ARCH_SPECS,
  ],
  [
    "反映済みでない PoC が上限を超える",
    arch({
      "../.spec-driven.json": () => JSON.stringify({ poc: { maxPending: 1 } }),
      "../poc/second/README.md": pendingPoc,
      "../poc/second/measure.md": () => "x\n",
      "../poc/third/README.md": pendingPoc,
      "../poc/third/measure.md": () => "x\n",
    }),
    "S017",
    ARCH_SPECS,
  ],
  [
    "architecture の H1",
    a(rep("# 通知配信サービス アーキテクチャ", "# 通知配信サービス 設計")),
    "F-A01",
    ARCH_SPECS,
  ],
  [
    "architecture の H2",
    a(rep("## 9. 横断的制約", "## 9. 制約")),
    "F-A02",
    ARCH_SPECS,
  ],
  [
    "構成要素の章に H3",
    a(rep("## 2. 構成要素\n", "## 2. 構成要素\n\n### 補足\n")),
    "F-A03",
    ARCH_SPECS,
  ],
  [
    "目的と範囲に箇条書き",
    a(
      rep(
        "通知配信サービスは、利用者の画面",
        "- 箇条書き。\n通知配信サービスは、利用者の画面",
      ),
    ),
    "F-A04",
    ARCH_SPECS,
  ],
  ["表の列見出しが違う", a(rep("方式", "手段")), "F-A05", ARCH_SPECS],
  [
    "種別が内部・外部でない",
    a(rep("| 内部 | 通知を宛先ごと", "| 中間 | 通知を宛先ごと")),
    "F-A06",
    ARCH_SPECS,
  ],
  [
    "IF の方向が不正",
    a(rep("| 提供 | 利用者 ", "| 受信 | 利用者 ")),
    "F-A07",
    ARCH_SPECS,
  ],
  [
    "内部の要素が関係図にない",
    a(rep('  api --> worker["配信ワーカー"]\n', "")),
    "F-A08",
    ARCH_SPECS,
  ],
  [
    "境界図の辺の名前が IF にない",
    a(rep("|通知表示|", "|通知閲覧|")),
    "F-A09",
    ARCH_SPECS,
  ],
  [
    "機能に関与の行がない",
    a(rep("- 関与: 発行元システム、配信ワーカー\n\n", "")),
    "F-A10",
    ARCH_SPECS,
  ],
  [
    "関与が構成要素表にない",
    a(
      rep(
        "- 関与: 発行元システム、配信ワーカー\n",
        "- 関与: 発行元システム、配信ワーカー、存在しない要素\n",
      ),
    ),
    "F-A11",
    ARCH_SPECS,
  ],
  [
    "根拠が spec 名でも poc/<テーマ> でもない",
    a(sub(/delivery-worker {2}\|/, "配信ワーカー  |")),
    "F-A12",
    ARCH_SPECS,
  ],
  [
    "機能が行数の上限を超える",
    a(
      sub(
        /(sequenceDiagram\n)(  participant ext_source)/,
        `$1${"  %% 補足\n".repeat(80)}$2`,
      ),
    ),
    "F-A13",
    ARCH_SPECS,
  ],
  [
    "関与と図のメッセージがどちらも同じ機能が複数ある",
    a(
      sub(
        /### 未読件数の表示\n[\s\S]*?(?=## 6\.)/,
        `### 通知の再発行\n\n${FIRST_FUNCTION}\n\n`,
      ),
    ),
    "F-A14",
    ARCH_SPECS,
  ],
  [
    "内部の要素どうしの呼び出しだけで、関与が 2 件の機能",
    a(
      sub(
        /### 未読件数の表示\n/,
        `### 通知の整形

- 関与: 通知API、配信ワーカー

通知の整形は、通知の有無で応答が分岐する。

\`\`\`mermaid
sequenceDiagram
  participant api as 通知API
  participant worker as 配信ワーカー
  api->>worker: 通知の取得
  alt 通知がある
    worker-->>api: 整形した通知
  else 通知がない
    worker-->>api: 空の応答
  end
\`\`\`

### 未読件数の表示
`,
      ),
    ),
    "F-A17",
    ARCH_SPECS,
  ],
  [
    "1 つの文書に置く機能が上限を超える",
    arch({ ...cfgOf({ architecture: { maxFunctions: 1 } }) }),
    "F-A18",
    ARCH_SPECS,
  ],
  [
    "機能の図に分岐がない",
    a(
      sub(
        / {2}alt 宛先が有効[\s\S]*? {2}end\n/,
        "  worker-->>ext_source: 受理\n",
      ),
    ),
    "G011",
    ARCH_SPECS,
  ],
  [
    "経緯・時点の語",
    a(rep("このサービスの対象外である。", "2026年の対象外である。")),
    "W009",
    ARCH_SPECS,
  ],
  [
    "文が「。」で終わらない",
    a(rep("このサービスの対象外である。", "このサービスの対象外")),
    "W010",
    ARCH_SPECS,
  ],
  [
    "表の文の列が体言止め",
    a(rep("未読件数を集計して返す", "未読件数の集計")),
    "W010",
    ARCH_SPECS,
  ],
  ["指示語", a(rep("このサービスの", "それの")), "W011", ARCH_SPECS],
  [
    "主語を示す助詞がない",
    a(rep("通知配信サービスは、利用者の画面へ", "利用者の画面へ")),
    "W012",
    ARCH_SPECS,
  ],
  [
    "地の文に spec 名",
    a(rep("このサービスの対象外である。", "delivery-worker の対象外である。")),
    "W013",
    ARCH_SPECS,
  ],
  [
    "spec と同じ行",
    a(
      rep(
        "通知の発行元システムは、このサービスの対象外である。",
        "未読の通知件数をヘッダーに表示し、利用者が新着通知に気付けるようにする。",
      ),
    ),
    "W014",
    ARCH_SPECS,
  ],
  [
    "PoC の H1",
    p(rep("# ストレージ費用 PoC", "# ストレージ費用")),
    "F-P01",
    ARCH_SPECS,
  ],
  ["PoC の H2", p(rep("## 5. 手順と結果", "## 5. 手順")), "F-P02", ARCH_SPECS],
  [
    "PoC の結論が箇条書き",
    p(
      rep("1 宛先あたり 1000 件の保管は、無料枠の範囲に収まる。", "- 箇条書き"),
    ),
    "F-P03",
    ARCH_SPECS,
  ],
  [
    "PoC の反映先が複数",
    p(rep("- delivery-worker", "- delivery-worker、notification-api")),
    "F-P04",
    ARCH_SPECS,
  ],
  [
    "PoC の制約値に数値がない",
    p(rep("| 1000 件 |", "| 多い |")),
    "F-P05",
    ARCH_SPECS,
  ],
  [
    "PoC の結果が合・否・- でない",
    p(rep("| 合   |", "| 良   |")),
    "F-P06",
    ARCH_SPECS,
  ],
  [
    "PoC のリンク先が存在しない",
    p(rep("(measure.md)", "(missing.md)")),
    "F-P07",
    ARCH_SPECS,
  ],
  [
    "PoC の結論があるのに結果が未記入",
    p(rep("| 合   |", "| -    |")),
    "F-P08",
    ARCH_SPECS,
  ],
  [
    "PoC の README が行数の上限を超える",
    p((t) => t + "- [測定手順と測定値](measure.md)\n".repeat(110)),
    "F-P09",
    ARCH_SPECS,
  ],
  [
    "信頼と検証の根拠の spec が存在しない",
    a(
      sub(
        /(配信ワーカーが API キーの一致を確認する +\| )delivery-worker/,
        "$1ghost-spec",
      ),
    ),
    "S013",
    ARCH_SPECS,
  ],
  [
    "信頼と検証の根拠が spec 名でも poc/<テーマ> でもない",
    a(
      sub(
        /(配信ワーカーが API キーの一致を確認する +\| )delivery-worker/,
        "$1配信ワーカー",
      ),
    ),
    "F-A12",
    ARCH_SPECS,
  ],
  [
    "architecture の図が Mermaid の構文エラー",
    a(rep('  api --> worker["配信ワーカー"]\n', "  api --> end\n")),
    "G014",
    ARCH_SPECS,
  ],
  [
    "PoC の README に曖昧語",
    p(rep("無料枠の範囲に収まる。", "無料枠の範囲に収まるなど。")),
    "W002",
    ARCH_SPECS,
  ],
  // ---- くくり別の architecture（全体 + くくりの文書） ----
  [
    "内部の構成要素が閾値以上なのに 1 ファイルのまま",
    arch(cfgOf({ architecture: { groupMinComponents: 3 } })),
    "S019",
    ARCH_SPECS,
  ],
  [
    "内部の構成要素が閾値未満なのにくくり別に分けている",
    grouped(cfgOf({ architecture: { groupMinComponents: 9 } })),
    "S019",
    GROUPED_SPECS,
  ],
  [
    "くくりの文書の 1 行目が全体のくくり名と違う",
    gr(G.store, rep("# 通知の保管 アーキテクチャ", "# 保管 アーキテクチャ")),
    "S011",
    GROUPED_SPECS,
  ],
  [
    "設計済み spec が、くくりの文書のどの実装spec にもない",
    grouped(),
    "S012",
    [...GROUPED_SPECS, "extra-spec"],
  ],
  [
    "実装spec が複数のくくりの文書に現れる",
    gr(G.store, rep("| read-position      |", "| publish-api        |")),
    "S012",
    GROUPED_SPECS,
  ],
  [
    "他機能の要素が別のくくりの文書の内部にない",
    gr(
      G.publish,
      rep("| 配信ワーカー   | 他機能", "| 存在しない要素 | 他機能"),
    ),
    "S020",
    GROUPED_SPECS,
  ],
  [
    "くくりの文書の外部の要素が全体の外部にない",
    gr(G.display, rep("| 利用者       | 外部", "| 閲覧者       | 外部")),
    "S021",
    GROUPED_SPECS,
  ],
  [
    "全体の IF の方向がくくりの文書と違う",
    gr(G.root, rep("| 提供 | 発行元システム |", "| 利用 | 発行元システム |")),
    "S021",
    GROUPED_SPECS,
  ],
  [
    "1 つのくくりの spec だけを根拠にする行が全体にある",
    gr(G.root, rep("publish-api、delivery-worker", "publish-api")),
    "S022",
    GROUPED_SPECS,
  ],
  [
    "他のくくりの spec を根拠にする行がくくりの文書にある",
    gr(G.display, rep("| notification-api |", "| delivery-worker |")),
    "S022",
    GROUPED_SPECS,
  ],
  [
    "全体の構成要素表の詳細が、くくり名のリンクでない",
    gr(G.root, rep("[通知の発行](architecture/publish.md)", "publish")),
    "F-A06",
    GROUPED_SPECS,
  ],
  [
    "機能のくくりの数が範囲外",
    grouped(cfgOf({ architecture: { groupCount: [4, 10] } })),
    "F-A19",
    GROUPED_SPECS,
  ],
  [
    "くくりの文書の内部の要素が範囲外",
    grouped(cfgOf({ architecture: { groupComponents: [2, 2] } })),
    "F-A19",
    GROUPED_SPECS,
  ],
  [
    "全体の関係図に、くくりの文書から導いた依存がない",
    gr(
      G.root,
      rep('  display["通知の表示"] --> store\n', '  display["通知の表示"]\n'),
    ),
    "F-A20",
    GROUPED_SPECS,
  ],
  [
    "全体の関係図に、くくりの文書にない依存がある",
    gr(
      G.root,
      rep(
        '  display["通知の表示"] --> store\n',
        '  display["通知の表示"] --> store\n  store --> publish\n',
      ),
    ),
    "F-A20",
    GROUPED_SPECS,
  ],
  [
    "くくりの文書の関係図が循環する",
    gr(
      G.display,
      rep(
        '  api --> worker["配信ワーカー"]\n',
        '  api --> worker["配信ワーカー"]\n  worker --> badge\n',
      ),
    ),
    "G009",
    GROUPED_SPECS,
  ],
  [
    "くくりの文書の目的が「。」で終わらない",
    gr(G.store, rep("管理する。\n", "管理する\n")),
    "W010",
    GROUPED_SPECS,
  ],
]

for (const [name, edits, rule, specNames] of docCases) {
  test(`${rule}: ${name}`, () => {
    if (rule === "G014") assert.equal(depsProblem, null, depsProblem)
    const r = (rule === "G014" ? runFull : run)(makeRoot(edits, specNames))
    assert.equal(r.code, 1, r.stderr)
    assert.ok(
      rulesOf(r.findings).includes(rule),
      `${rule} が検出されない: ${JSON.stringify(rulesOf(r.findings))}`,
    )
  })
}

// ---------------------------------------------------------------------------

test("architecture と PoC の雛形はすべてのチェックを通過する", () => {
  assert.equal(depsProblem, null, depsProblem)
  const r = runFull(makeRoot(arch(), ARCH_SPECS))
  assert.deepEqual(r.findings, [])
  assert.equal(r.code, 0)
})

test("architecture の出力は冪等", () => {
  const root = makeRoot(a(rep("このサービスの", "それの")), ARCH_SPECS)
  assert.deepEqual(run(root), run(root))
})

test("くくり別の architecture の雛形はすべてのチェックを通過する", () => {
  assert.equal(depsProblem, null, depsProblem)
  const r = runFull(makeRoot(grouped(), GROUPED_SPECS))
  assert.deepEqual(r.findings, [])
  assert.equal(r.code, 0)
})

test("構成要素が閾値未満なら 1 ファイルのままでよく、設定で閾値を下げるとくくり別にできる", () => {
  assert.deepEqual(run(makeRoot(arch(), ARCH_SPECS)).findings, [])
  const cfg = cfgOf({ architecture: { groupMinComponents: 8 } })
  assert.deepEqual(run(makeRoot(grouped(cfg), GROUPED_SPECS)).findings, [])
})

test("旧形式（機能ごとの分割ファイル）は、ファイルごとの指摘ではなく移行の 1 件にまとまる", () => {
  const r = run(
    makeRoot(
      arch({ [PART]: () => `# 通知の発行\n\n${FIRST_FUNCTION}\n` }),
      ARCH_SPECS,
    ),
  )
  assert.deepEqual(
    r.findings.map((f) => `${f.file} ${f.rule}`),
    ["docs/architecture S011"],
  )
  assert.match(r.findings[0].message, /旧形式/)
})

test("くくりの文書の指摘は、その文書のパスで報告される", () => {
  const r = run(
    makeRoot(gr(G.store, rep("管理する。\n", "管理する\n")), GROUPED_SPECS),
  )
  const f = r.findings.find((x) => x.rule === "W010")
  assert.equal(f.file, "docs/architecture/store.md")
})

test("architecture を対象にすると、くくりの文書も検査する", () => {
  const root = makeRoot(
    gr(G.store, rep("管理する。\n", "管理する\n")),
    GROUPED_SPECS,
  )
  assert.equal(run(root, "architecture").code, 1)
})

test("architecture の W001・W004 は経緯・進捗の語を検出する", () => {
  const r = run(makeRoot(a(rep("このサービスの", "従来の今後の")), ARCH_SPECS))
  assert.ok(rulesOf(r.findings).includes("W004"), JSON.stringify(r.findings))
  assert.ok(rulesOf(r.findings).includes("W001"), JSON.stringify(r.findings))
})

test("関与が同じでも図のメッセージが違う機能は、統合を求めない", () => {
  const sameActors = `### 通知の再送

- 関与: 発行元システム、配信ワーカー

通知の再送は、受理した通知を宛先へ送り直す。

\`\`\`mermaid
sequenceDiagram
  participant ext_source as 発行元システム
  participant worker as 配信ワーカー
  worker->>ext_source: 再送の可否を照会
  ext_source-->>worker: 再送の指示
\`\`\`

`
  const r = run(
    makeRoot(
      a(sub(/### 未読件数の表示\n/, `${sameActors}### 未読件数の表示\n`)),
      ARCH_SPECS,
    ),
  )
  assert.deepEqual(r.findings, [])
})

test("architecture の3章で関係図が循環すると G009 を検出する", () => {
  const r = run(
    makeRoot(
      a(
        rep(
          '  api --> worker["配信ワーカー"]\n',
          '  api --> worker["配信ワーカー"]\n  worker --> badge\n',
        ),
      ),
      ARCH_SPECS,
    ),
  )
  assert.ok(rulesOf(r.findings).includes("G009"), JSON.stringify(r.findings))
})

test("要件のみの spec は S003 の対象外で、閾値の計数にも実装spec にも含まれない", () => {
  const future = { "future/requirements.md": () => read("requirements.md") }
  assert.deepEqual(
    run(makeRoot(future, ["notification-api", "delivery-worker"])).findings,
    [],
  )
  const listed = run(
    makeRoot(
      arch({
        ...future,
        [ARCH]: rep("| delivery-worker    |", "| delivery-worker, future |"),
      }),
      ARCH_SPECS,
    ),
  )
  assert.ok(
    rulesOf(listed.findings).includes("S012"),
    JSON.stringify(listed.findings),
  )
})

test("閾値は設定で調整できる（spec 数が閾値未満なら architecture.md は任意）", () => {
  const cfg = {
    "../.spec-driven.json": () =>
      JSON.stringify({ architecture: { minSpecs: 4 } }),
  }
  assert.deepEqual(run(makeRoot(cfg, ARCH_SPECS)).findings, [])
})

test("設定ファイルの誤りは終了コード 2 で止まる", () => {
  const bad = [
    ["JSON でない", "{"],
    ["未知のキー", '{"unknown": 1}'],
    ["未知の項目", '{"poc": {"nothing": 1}}'],
    ["範囲外（下限）", '{"architecture": {"minSpecs": 0}}'],
    ["範囲外（上限）", '{"poc": {"maxPending": 11}}'],
    ["型違い", '{"architecture": {"maxLines": "400"}}'],
    ["関与数の逆転", '{"architecture": {"functionComponents": [6, 2]}}'],
    ["くくりの要素数の逆転", '{"architecture": {"groupComponents": [5, 2]}}'],
    ["くくりの数が範囲外", '{"architecture": {"groupCount": [1, 5]}}'],
    [
      "くくり別にする閾値が範囲外",
      '{"architecture": {"groupMinComponents": 1}}',
    ],
  ]
  for (const [name, text] of bad) {
    const r = run(makeRoot({ "../.spec-driven.json": () => text }))
    assert.equal(r.code, 2, `${name}: ${r.stderr}`)
  }
})

test("--show-config は実効値を表示する", () => {
  const root = makeRoot({
    "../.spec-driven.json": () => JSON.stringify({ poc: { maxPending: 5 } }),
  })
  const r = spawnSync(
    process.execPath,
    [checkAll, "--root", "specs", "--show-config"],
    { cwd: root, encoding: "utf8" },
  )
  const cfg = JSON.parse(r.stdout)
  assert.equal(cfg.poc.maxPending, 5)
  assert.equal(cfg.architecture.minSpecs, 3)
  assert.deepEqual(cfg.architecture.functionComponents, [2, 6])
  assert.deepEqual(cfg.architecture.groupComponents, [2, 8])
  assert.deepEqual(cfg.architecture.groupCount, [3, 10])
  assert.equal(cfg.architecture.groupMinComponents, 8)
  assert.equal(cfg.architecture.maxGroupLines, 300)
  assert.equal(cfg.architecture.maxFunctions, 5)
})

test("設定の雛形は初期値と一致する", () => {
  const show = (edits) =>
    JSON.parse(
      spawnSync(
        process.execPath,
        [checkAll, "--root", "specs", "--show-config"],
        { cwd: makeRoot(edits), encoding: "utf8" },
      ).stdout,
    )
  assert.deepEqual(
    show({ "../.spec-driven.json": () => read("spec-driven.json") }),
    show({}),
  )
  assert.deepEqual(show({}).architecture, {
    ...JSON.parse(read("spec-driven.json")).architecture,
  })
})

test("architecture・PoC を対象に指定できる", () => {
  const root = makeRoot(arch(), ARCH_SPECS)
  assert.equal(run(root, "architecture").code, 0)
  assert.equal(run(root, "poc/storage-cost").code, 0)
  assert.equal(run(root, "poc/missing").code, 2)
})

test("--status は成果物から工程を導出する", () => {
  const root = makeRoot(
    arch({ "delivery-worker/tasks.md": (t) => t.replace("- [ ]", "- [x]") }),
    ARCH_SPECS,
  )
  const r = spawnSync(
    process.execPath,
    [checkAll, "--root", "specs", "--status", "--json"],
    { cwd: root, encoding: "utf8" },
  )
  assert.equal(r.status, 0, r.stderr)
  const m = JSON.parse(r.stdout)
  assert.equal(
    m.specs.find((s) => s.name === "delivery-worker").state,
    "進行中",
  )
  assert.equal(
    m.specs.find((s) => s.name === "notification-api").state,
    "着手前",
  )
  assert.deepEqual(m.pocs, [
    {
      name: "storage-cost",
      state: "反映済み",
      target: "delivery-worker",
      remove: false,
    },
  ])
  assert.equal(m.architecture.required, true)
  assert.equal(m.architecture.crossFindings, 0)
})

test("--status は architecture の形式（1 ファイルかくくり別か）を導出する", () => {
  const status = (edits, specs) => {
    const r = spawnSync(
      process.execPath,
      [checkAll, "--root", "specs", "--status", "--json"],
      { cwd: makeRoot(edits, specs), encoding: "utf8" },
    )
    return JSON.parse(r.stdout).architecture
  }
  const single = status(arch(), ARCH_SPECS)
  assert.equal(single.mode, "single")
  assert.equal(single.internalComponents, 3)
  const multi = status(grouped(), GROUPED_SPECS)
  assert.equal(multi.mode, "grouped")
  assert.equal(multi.internalComponents, 8)
  assert.equal(multi.parts, 3)
  assert.equal(multi.crossFindings, 0)
})

test("PoC の状態: 結論なしは検証中、反映先なしは反映待ち", () => {
  const status = (edit) => {
    const root = makeRoot(arch({ [POC]: edit }), ARCH_SPECS)
    const r = spawnSync(
      process.execPath,
      [checkAll, "--root", "specs", "--status", "--json"],
      { cwd: root, encoding: "utf8" },
    )
    return JSON.parse(r.stdout).pocs[0].state
  }
  assert.equal(status(pendingPoc), "検証中")
  assert.equal(status(rep("- delivery-worker", "- なし")), "反映待ち")
})

// ---- --retarget-poc ----

test("--retarget-poc は根拠の poc/<テーマ> を反映先 spec へ付け替える（既定は表示のみ）", () => {
  const root = makeRoot(arch(), ARCH_SPECS)
  const file = path.join(root, "docs", "architecture.md")
  const before = fs.readFileSync(file, "utf8")
  const cli = (...args) =>
    spawnSync(
      process.execPath,
      [checkAll, "--root", "specs", "--retarget-poc", "storage-cost", ...args],
      { cwd: root, encoding: "utf8" },
    )
  const dry = cli()
  assert.equal(dry.status, 0, dry.stderr)
  assert.match(dry.stdout, /poc\/storage-cost → delivery-worker/)
  assert.equal(fs.readFileSync(file, "utf8"), before)
  const w = cli("--write")
  assert.equal(w.status, 0, w.stderr)
  const after = fs.readFileSync(file, "utf8")
  assert.ok(!after.includes("poc/storage-cost"))
  assert.equal(after.split("\n").length, before.split("\n").length)
  assert.match(
    after,
    /\| 1 宛先あたりの保管件数 \| 1000 件 +\| delivery-worker/,
  )
  assert.match(after, /\| データ保管 .*\| delivery-worker/)
  // 付け替え後に再実行しても対象がない
  assert.match(cli().stdout, /付け替え対象なし/)
})

test("--retarget-poc は信頼と検証の根拠も付け替える", () => {
  const root = makeRoot(
    a(
      sub(
        /(配信ワーカーが API キーの一致を確認する +\| )delivery-worker/,
        "$1poc/storage-cost",
      ),
    ),
    ARCH_SPECS,
  )
  const r = spawnSync(
    process.execPath,
    [checkAll, "--root", "specs", "--retarget-poc", "storage-cost", "--write"],
    { cwd: root, encoding: "utf8" },
  )
  assert.equal(r.status, 0, r.stderr)
  const after = fs.readFileSync(
    path.join(root, "docs", "architecture.md"),
    "utf8",
  )
  assert.match(
    after,
    /配信ワーカーが API キーの一致を確認する +\| delivery-worker/,
  )
  assert.ok(!after.includes("poc/storage-cost"))
})

test("--retarget-poc はくくりの文書の根拠も付け替える", () => {
  const root = makeRoot(
    grouped({
      [G.store]: sub(
        /(1回の問い合わせで行える +\| )notification-store/,
        "$1poc/storage-cost",
      ),
      [POC]: () =>
        read("poc-readme.md").replace(
          "- delivery-worker",
          "- notification-store",
        ),
      "../poc/storage-cost/measure.md": () => "測定値\n",
    }),
    GROUPED_SPECS,
  )
  const r = spawnSync(
    process.execPath,
    [checkAll, "--root", "specs", "--retarget-poc", "storage-cost", "--write"],
    { cwd: root, encoding: "utf8" },
  )
  assert.equal(r.status, 0, r.stderr)
  const after = fs.readFileSync(
    path.join(root, "docs", "architecture", "store.md"),
    "utf8",
  )
  assert.ok(!after.includes("poc/storage-cost"))
  assert.match(after, /データ保管 .*\| notification-store/)
})

test("--retarget-poc は反映先が決まらない PoC を拒否する", () => {
  const root = makeRoot(
    arch({ [POC]: rep("- delivery-worker", "- なし") }),
    ARCH_SPECS,
  )
  const r = spawnSync(
    process.execPath,
    [checkAll, "--root", "specs", "--retarget-poc", "storage-cost"],
    { cwd: root, encoding: "utf8" },
  )
  assert.equal(r.status, 2)
  assert.match(r.stderr, /反映先/)
})

// ---- --check-poc-committed ----

const git = (cwd, ...args) =>
  spawnSync(
    "git",
    [
      "-c",
      "user.name=t",
      "-c",
      "user.email=t@example.com",
      "-c",
      "commit.gpgsign=false",
      ...args,
    ],
    { cwd, encoding: "utf8" },
  )
const check = (root, theme) =>
  spawnSync(
    process.execPath,
    [checkAll, "--root", "specs", "--check-poc-committed", theme],
    { cwd: root, encoding: "utf8" },
  )

test("--check-poc-committed: 追跡外は 2、未コミットは 1、コミット済みは 0", () => {
  const root = makeRoot(arch(), ARCH_SPECS)
  // git 管理外
  assert.equal(check(root, "storage-cost").status, 2)
  git(root, "init", "-q")
  // 追跡外
  assert.equal(check(root, "storage-cost").status, 2)
  git(root, "add", "-A")
  // ステージ済みで未コミット
  assert.equal(check(root, "storage-cost").status, 1)
  git(root, "commit", "-q", "-m", "init")
  assert.equal(check(root, "storage-cost").status, 0)
  // コミット後の変更
  fs.appendFileSync(
    path.join(root, "poc", "storage-cost", "measure.md"),
    "追記\n",
  )
  assert.equal(check(root, "storage-cost").status, 1)
  // 追跡済みディレクトリに未追跡のファイルを足した場合
  git(root, "checkout", "--", ".")
  fs.writeFileSync(path.join(root, "poc", "storage-cost", "extra.md"), "x\n")
  assert.equal(check(root, "storage-cost").status, 1)
  // 不正なテーマ名・存在しないテーマ
  assert.equal(check(root, "../specs").status, 2)
  assert.equal(check(root, "missing").status, 2)
})

test("51 件の spec でも検査が現実的な時間で終わる", () => {
  const names = Array.from(
    { length: 51 },
    (_, i) => `spec-${String(i).padStart(2, "0")}`,
  )
  const t0 = Date.now()
  const r = run(makeRoot({}, names))
  assert.deepEqual(rulesOf(r.findings), ["S010"])
  assert.ok(Date.now() - t0 < 30000, `${Date.now() - t0} ミリ秒`)
})
