/**
 * 仕様書チェックスクリプトの自己テスト（node --test で実行）。
 *
 * - 雛形（templates/）がすべてのチェックを通過すること
 * - 雛形を1か所ずつ崩したとき、対応するルールが検出されること
 * - 同じ入力に対して出力が一致すること（冪等性）
 * - references/rules.md がスクリプトのルール定義と一致すること
 *
 * Mermaid の構文検証（G014）は1回あたり約1秒かかるため、通過の確認（runFull）と G014 のケース
 * だけで使い、ほかのケースは --no-syntax で省く。G014 には scripts/ への依存の導入が必要で、
 * 未導入の環境では G014 に関わるケースだけが導入手順を示して失敗する。
 *   npm ci --ignore-scripts --prefix <scripts のパス>
 */
import { after, test } from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { spawnSync } from "node:child_process"
import { fileURLToPath } from "node:url"
import { setupProblem } from "./mermaid-syntax.mjs"

const here = path.dirname(fileURLToPath(import.meta.url))
const skill = path.dirname(here)
const templates = path.join(skill, "templates")

// 依存が未導入なら案内文（導入済みなら null）
const depsProblem = setupProblem()

const roots = []
after(() => roots.forEach(r => fs.rmSync(r, { recursive: true, force: true })))

/** 雛形から spec を作る。edits: { "<spec>/<file>": (text) => text } */
function makeRoot(edits = {}, specNames = ["sample"]) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "spec-selftest-"))
  roots.push(root)
  const specs = path.join(root, "specs")
  for (const name of specNames) {
    fs.mkdirSync(path.join(specs, name), { recursive: true })
    for (const f of ["requirements.md", "design.md", "tasks.md"]) {
      fs.copyFileSync(path.join(templates, f), path.join(specs, name, f))
    }
  }
  for (const [key, fn] of Object.entries(edits)) {
    const p = path.join(specs, key)
    fs.mkdirSync(path.dirname(p), { recursive: true })
    const before = fs.existsSync(p) ? fs.readFileSync(p, "utf8") : ""
    if (fn === null) fs.rmSync(p, { force: true })
    else fs.writeFileSync(p, fn(before))
  }
  return root
}

const checkAll = path.join(here, "check-all.mjs")

/** 構文検証を省いて実行する */
function run(root, ...args) {
  return runWith(checkAll, root, ["--no-syntax", ...args])
}

/** 構文検証つきで実行する（依存が未導入なら省く） */
function runFull(root, ...args) {
  return runWith(checkAll, root, [
    ...(depsProblem ? ["--no-syntax"] : []),
    ...args,
  ])
}

function runWith(script, root, args) {
  const r = spawnSync(
    process.execPath,
    [script, "--root", "specs", "--json", ...args],
    {
      cwd: root,
      encoding: "utf8",
    },
  )
  return {
    code: r.status,
    findings: r.stdout.trim() === "" ? [] : JSON.parse(r.stdout),
    stderr: r.stderr,
  }
}

const rulesOf = findings => [...new Set(findings.map(f => f.rule))].sort()

test("雛形はすべてのチェックを通過する", () => {
  const r = runFull(makeRoot())
  assert.deepEqual(r.findings, [])
  assert.equal(r.code, 0)
})

test("同じ入力に対して出力が一致する（冪等）", () => {
  const root = makeRoot({ "sample/design.md": t => t + "\n今後対応する。\n" })
  const a = run(root)
  const b = run(root)
  assert.deepEqual(a, b)
  assert.equal(a.code, 1)
})

test("references/rules.md がルール定義と一致する", () => {
  const r = spawnSync(
    process.execPath,
    [path.join(here, "check-all.mjs"), "--rules"],
    { encoding: "utf8" },
  )
  assert.equal(
    fs.readFileSync(path.join(skill, "references", "rules.md"), "utf8"),
    r.stdout,
  )
})

const rep = (from, to) => t => {
  assert.ok(t.includes(from), `置換元が雛形にない: ${from}`)
  return t.replace(from, to)
}

// 全タスク完了済みで、構成表のパス・テスト・受け入れ条件タグがすべて揃った状態
const completed = {
  "sample/tasks.md": t => t.replaceAll("- [ ]", "- [x]"),
  "../src/lib/notification/unreadCount.ts": () => "export {}\n",
  "../src/lib/notification/useUnreadCount.ts": () => "export {}\n",
  "../src/components/layout/Header.tsx": () => "export {}\n",
  "../src/components/notification/NotificationBadge.tsx": () => "export {}\n",
  "../tests/lib/notification/unreadCount.test.ts": () =>
    'test("sample/AC-1")\ntest("sample/AC-2")\n',
  "../tests/e2e/notificationBadge.spec.ts": () => 'test("sample/AC-3")\n',
}

test("全タスク完了済みで実装・テストが揃った spec は通過する", () => {
  const r = runFull(makeRoot(completed))
  assert.deepEqual(r.findings, [])
})

/** 図の章（見出し直後〜次の H2 まで）の本文を差し替える */
const chapter = fn => t =>
  t.replace(
    /(## 2\. 関係図・ワークフロー\n\n)[\s\S]*?(?=## 3\.)/,
    (_, head) => head + fn() + (fn() === "" ? "" : "\n"),
  )

/** 有効な状態図を追加した design.md に対して edit を適用する */
const STATE_DIAGRAM = `遷移の様子を示す。

\`\`\`mermaid
stateDiagram-v2
  [*] --> Idle
  Idle --> Loading: 開始
  Loading --> Ready: 成功
  Loading --> Failed: 失敗
  Ready --> [*]
  Failed --> [*]
\`\`\`

`
const withState = edit => t =>
  edit(t.replace("## 3. 設計項目", STATE_DIAGRAM + "## 3. 設計項目"))

// [説明, edits, 期待ルール, 追加 spec 名]
const cases = [
  ["specs 直下のファイル", { "README.md": () => "x\n" }, "S001"],
  ["ディレクトリ名", {}, "S002", ["Sample_Dir"]],
  [
    "サブディレクトリ",
    { "sample/backend/requirements.md": () => "x\n" },
    "S003",
  ],
  ["ファイル欠落", { "sample/tasks.md": null }, "S003"],
  [
    "他 spec への参照",
    {
      "sample/design.md": rep(
        "件数取得はヘッダー",
        "`other-spec` と同様に件数取得はヘッダー",
      ),
    },
    "S004",
    ["sample", "other-spec"],
  ],
  [
    "前提先が存在しない",
    {
      "sample/requirements.md": rep(
        "- なし\n\n## 4",
        "- 前提: missing — 理由。\n\n## 4",
      ),
    },
    "S005",
  ],
  [
    "前提の連鎖",
    {
      "a/requirements.md": rep("- なし\n\n## 4", "- 前提: b — 理由。\n\n## 4"),
      "b/requirements.md": rep("- なし\n\n## 4", "- 前提: c — 理由。\n\n## 4"),
    },
    "S005",
    ["a", "b", "c"],
  ],
  [
    "完了 spec の構成パス一部不在",
    {
      ...completed,
      "../src/components/notification/NotificationBadge.tsx": null,
    },
    "S006",
  ],
  [
    "完了 spec のテスト不在",
    { ...completed, "../tests/e2e/notificationBadge.spec.ts": null },
    "S007",
  ],
  [
    "完了 spec の受け入れ条件にテストがない",
    {
      ...completed,
      "../tests/lib/notification/unreadCount.test.ts": () =>
        'test("sample/AC-1")\n',
    },
    "S008",
  ],
  [
    "dead spec",
    { "sample/tasks.md": t => t.replaceAll("- [ ]", "- [x]") },
    "S009",
  ],
  [
    "要件 H1",
    {
      "sample/requirements.md": rep("# 通知バッジ 要件定義書", "# 通知バッジ"),
    },
    "F-R01",
  ],
  [
    "要件 H2 順序",
    { "sample/requirements.md": rep("## 3. 前提\n\n- なし\n\n", "") },
    "F-R02",
  ],
  [
    "要件 H3",
    {
      "sample/requirements.md": rep(
        "## 4. 機能要件\n",
        "## 4. 機能要件\n\n### 4.1 表示\n",
      ),
    },
    "F-R03",
  ],
  [
    "要件 表",
    { "sample/requirements.md": rep("- 通知本文の一覧表示。", "| a | b |") },
    "F-R04",
  ],
  [
    "目的 箇条書き",
    { "sample/requirements.md": rep("未読の通知件数", "- 未読の通知件数") },
    "F-R05",
  ],
  [
    "スコープ 地の文",
    {
      "sample/requirements.md": rep(
        "- 通知本文の一覧表示。",
        "通知本文の一覧表示。",
      ),
    },
    "F-R06",
  ],
  [
    "前提 形式",
    {
      "sample/requirements.md": rep(
        "- なし\n\n## 4",
        "- creator-mode に依存する。\n\n## 4",
      ),
    },
    "F-R07",
  ],
  ["FR 連番", { "sample/requirements.md": rep("- FR-2:", "- FR-3:") }, "F-R08"],
  [
    "FR 複文",
    {
      "sample/requirements.md": rep(
        "数字で表示する。",
        "数字で表示する。色は赤。",
      ),
    },
    "F-R09",
  ],
  [
    "FR が他 ID に言及",
    {
      "sample/requirements.md": rep(
        "バッジを表示しない。",
        "FR-1 のバッジを表示しない。",
      ),
    },
    "F-R09",
  ],
  [
    "NFR 定量性",
    {
      "sample/requirements.md": rep(
        "ページ読み込み開始から1秒以内に",
        "速やかに",
      ),
    },
    "F-R10",
  ],
  [
    "AC 参照先不在",
    { "sample/requirements.md": rep("- AC-2 (FR-2)", "- AC-2 (FR-9)") },
    "F-R11",
  ],
  [
    "AC 未対応の要件",
    {
      "sample/requirements.md": rep(
        "- AC-2 (FR-2): 未読が0件のとき、バッジが描画されない。\n",
        "",
      ),
    },
    "F-R12",
  ],
  [
    "要件 行数",
    {
      "sample/requirements.md": t =>
        t.replace(
          "- 通知本文の一覧表示。",
          "- 通知本文の一覧表示。\n".repeat(100).trim(),
        ),
    },
    "F-R13",
  ],
  [
    "設計 H1",
    { "sample/design.md": rep("# 通知バッジ 設計書", "# 設計") },
    "F-D01",
  ],
  [
    "設計 H2",
    { "sample/design.md": rep("## 4. エラー処理", "## 4. 例外") },
    "F-D02",
  ],
  [
    "設計 D 見出し形式",
    {
      "sample/design.md": rep(
        "### D-2: 表示タイミング (NFR-1)",
        "### D-2: 表示タイミング",
      ),
    },
    "F-D03",
  ],
  [
    "設計 H4",
    {
      "sample/design.md": rep(
        "件数取得はヘッダー",
        "#### 補足\n\n件数取得はヘッダー",
      ),
    },
    "F-D03",
  ],
  [
    "構成表 見出し",
    { "sample/design.md": rep("| パス ", "| ファイル ") },
    "F-D04",
  ],
  [
    "D にコード・表がない",
    {
      "sample/design.md": t =>
        t.replace(
          /### D-2[\s\S]*?(?=## 4)/,
          "### D-2: 表示タイミング (NFR-1)\n\n説明のみ。\n\n",
        ),
    },
    "F-D05",
  ],
  [
    "D の行数",
    {
      "sample/design.md": rep(
        "件数取得はヘッダー",
        "行。\n".repeat(61) + "件数取得はヘッダー",
      ),
    },
    "F-D06",
  ],
  [
    "要件の設計漏れ",
    { "sample/design.md": rep("(FR-1, FR-2)", "(FR-1)") },
    "F-D07",
  ],
  [
    "D 本文で ID 言及",
    {
      "sample/design.md": rep(
        "件数取得はヘッダー",
        "FR-1 のため件数取得はヘッダー",
      ),
    },
    "F-D08",
  ],
  [
    "エラー処理 地の文",
    {
      "sample/design.md": t =>
        t.replace(
          /## 4\. エラー処理[\s\S]*$/,
          "## 4. エラー処理\n\n失敗時は描画しない。\n",
        ),
    },
    "F-D09",
  ],
  [
    "設計 行数",
    { "sample/design.md": t => t + "\n".repeat(1) + "| x | y |\n".repeat(300) },
    "F-D10",
  ],
  [
    "タスク H1",
    { "sample/tasks.md": rep("# 通知バッジ タスク一覧", "# タスク") },
    "F-T01",
  ],
  [
    "Phase 連番",
    { "sample/tasks.md": rep("## Phase 2:", "## Phase 3:") },
    "F-T02",
  ],
  [
    "Phase 数",
    {
      "sample/tasks.md": t =>
        t +
        [3, 4, 5, 6]
          .map(
            p =>
              `\n## Phase ${p}: 追加\n\n- 対応: D-2\n- [ ] T-${p}.1: 作業。\n- 検証: \`npm test\`\n`,
          )
          .join(""),
    },
    "F-T02",
  ],
  [
    "タスク H3",
    { "sample/tasks.md": rep("- 対応: D-1", "### 準備\n\n- 対応: D-1") },
    "F-T03",
  ],
  ["タスク連番", { "sample/tasks.md": rep("T-1.2:", "T-1.3:") }, "F-T04"],
  [
    "検証行なし",
    { "sample/tasks.md": rep("- 検証: `npm run build`\n", "") },
    "F-T05",
  ],
  [
    "UI Phase の E2E なし",
    { "sample/tasks.md": t => t.replace(/- E2E:.*\n/, "") },
    "F-T06",
  ],
  [
    "雛形外の行",
    { "sample/tasks.md": rep("- 対応: D-1\n", "- 対応: D-1\n依存: なし\n") },
    "F-T07",
  ],
  [
    "D の重複割り当て",
    { "sample/tasks.md": rep("- 対応: D-2", "- 対応: D-1, D-2") },
    "F-T08",
  ],
  [
    "タスク総数",
    {
      "sample/tasks.md": t =>
        t +
        [3, 4, 5]
          .map(
            p =>
              `\n## Phase ${p}: 追加\n\n- 対応: D-2\n` +
              Array.from(
                { length: 10 },
                (_, i) => `- [ ] T-${p}.${i + 1}: 作業${p}-${i + 1}。\n`,
              ).join("") +
              "- 検証: `npm test`\n",
          )
          .join(""),
    },
    "F-T09",
  ],
  [
    "タスク 行数",
    {
      "sample/tasks.md": rep("- [ ] T-1.1:", "\n".repeat(100) + "- [ ] T-1.1:"),
    },
    "F-T10",
  ],
  [
    "進捗語",
    { "sample/design.md": rep("件数取得はヘッダー", "件数取得は今後ヘッダー") },
    "W001",
  ],
  [
    "曖昧語",
    {
      "sample/design.md": rep(
        "件数取得はヘッダー",
        "件数取得は必要に応じてヘッダー",
      ),
    },
    "W002",
  ],
  [
    "要件に実装詳細",
    {
      "sample/requirements.md": rep(
        "- 通知本文の一覧表示。",
        "- `NoticeList.tsx` の表示。",
      ),
    },
    "W003",
  ],
  [
    "経緯語",
    {
      "sample/requirements.md": rep(
        "- 通知本文の一覧表示。",
        "- 従来の通知本文の一覧表示。",
      ),
    },
    "W004",
  ],
  [
    "仕様書ファイル名",
    {
      "sample/design.md": rep(
        "件数取得はヘッダー",
        "requirements.md に従い件数取得はヘッダー",
      ),
    },
    "W005",
  ],
  [
    "タスクに判断語",
    { "sample/tasks.md": rep("を実装する。", "を実装するか検討する。") },
    "W006",
  ],
  [
    "絵文字",
    { "sample/tasks.md": rep("を実装する。", "を実装する ✅") },
    "W007",
  ],
  [
    "重複行",
    {
      "sample/design.md": rep(
        "件数取得はヘッダー",
        "未読の通知件数をヘッダーに表示し、利用者が新着通知に気付けるようにする。\n\n件数取得はヘッダー",
      ),
    },
    "W008",
  ],

  // --- 図チェック（check-diagram） ---
  [
    "構成表4行で図が「- なし」",
    { "sample/design.md": chapter(() => "- なし\n") },
    "G001",
  ],
  ["図の章が空", { "sample/design.md": chapter(() => "") }, "G001"],
  [
    "図の章に箇条書き",
    {
      "sample/design.md": rep(
        "呼び出しの依存方向を示す。\n",
        "呼び出しの依存方向を示す。\n\n- 補足\n",
      ),
    },
    "G002",
  ],
  [
    "図の章に他言語のコードブロック",
    {
      "sample/design.md": rep(
        "## 3. 設計項目",
        "```ts\nexport {}\n```\n\n## 3. 設計項目",
      ),
    },
    "G002",
  ],
  [
    "図の説明が図の言い換え",
    {
      "sample/design.md": rep(
        "呼び出しの依存方向を示す。",
        "Header と NotificationBadge と useUnreadCount の依存方向を示す。",
      ),
    },
    "G003",
  ],
  [
    "図の説明が80文字超",
    {
      "sample/design.md": rep(
        "呼び出しの依存方向を示す。",
        "呼び出しの依存方向を示す".repeat(8) + "。",
      ),
    },
    "G003",
  ],
  ["図種が不正", { "sample/design.md": rep("flowchart LR", "pie") }, "G004"],
  [
    "ワークフロー図がない",
    {
      "sample/design.md": t =>
        t.replace(/件数の取得から[\s\S]*?\n```\n\n(?=## 3)/, ""),
    },
    "G004",
  ],
  [
    "図の記法が部分集合の外",
    {
      "sample/design.md": rep(
        "  Header --> NotificationBadge\n",
        "  Header --- NotificationBadge\n",
      ),
    },
    "G005",
  ],
  [
    "孤立ノード",
    {
      "sample/design.md": rep(
        "  Header --> NotificationBadge\n",
        "  Header --> NotificationBadge\n  ext_orphan\n",
      ),
    },
    "G006",
  ],
  [
    "ノード名が長い",
    {
      "sample/design.md": rep(
        'ext_agent["Agent"]',
        'ext_agent["' + "とても長いエージェント名".repeat(4) + '"]',
      ),
    },
    "G006",
  ],
  [
    "構成表にないノード",
    {
      "sample/design.md": rep(
        "NotificationBadge --> unreadCount\n",
        "NotificationBadge --> Unknown\n  Unknown --> unreadCount\n",
      ),
    },
    "G007",
  ],
  [
    "構成表の要素に ext_ を付けた",
    {
      "sample/design.md": rep(
        'unreadCount --> ext_agent["Agent"]',
        'unreadCount --> ext_agent["Agent"]\n  Header --> ext_x["Header"]',
      ),
    },
    "G007",
  ],
  [
    "構成表の行が関係図にない",
    {
      "sample/design.md": rep("  Header --> NotificationBadge\n", ""),
    },
    "G008",
  ],
  [
    "関係図に循環依存",
    {
      "sample/design.md": rep(
        "  useUnreadCount --> unreadCount\n",
        "  useUnreadCount --> unreadCount\n  unreadCount --> NotificationBadge\n",
      ),
    },
    "G009",
  ],
  [
    "export 名が図にない",
    {
      "sample/design.md": rep(
        "export function formatBadge",
        "export function formatBadgeText",
      ),
    },
    "G010",
  ],
  [
    "ワークフロー図に分岐がない",
    {
      "sample/design.md": t =>
        t.replace(
          /  alt 取得失敗[\s\S]*?\n  end\n/,
          "  unreadCount-->>useUnreadCount: 件数\n  useUnreadCount-->>NotificationBadge: 件数\n  NotificationBadge->>unreadCount: formatBadge\n",
        ),
    },
    "G011",
  ],
  [
    "状態 ID が PascalCase でない",
    { "sample/design.md": withState(t => t.replaceAll("Idle", "idle")) },
    "G012",
  ],
  [
    "遷移ラベルが長い",
    {
      "sample/design.md": withState(
        rep("Ready: 成功", "Ready: サーバーから成功の応答を受け取った"),
      ),
    },
    "G012",
  ],
  [
    "状態から出る遷移がない",
    { "sample/design.md": withState(rep("  Failed --> [*]\n", "")) },
    "G013",
  ],
  [
    "状態が開始から到達できない",
    {
      "sample/design.md": withState(
        rep("  Failed --> [*]\n", "  Failed --> [*]\n  Orphan --> [*]\n"),
      ),
    },
    "G013",
  ],
  [
    "Mermaid が構文エラーとする記述（予約語 end を ID にする）",
    {
      "sample/design.md": rep(
        "  Header --> NotificationBadge\n",
        "  Header --> NotificationBadge\n  Header --> end\n",
      ),
    },
    "G014",
  ],
  [
    "図の中の進捗語",
    { "sample/design.md": rep("マウント", "今後マウント") },
    "W001",
  ],
]

for (const [name, edits, rule, specNames] of cases) {
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

test("状態図を追加しても通過する", () => {
  const r = runFull(makeRoot({ "sample/design.md": withState(t => t) }))
  assert.deepEqual(r.findings, [])
})

test("構成表が3行以下なら図を「- なし」で免除できる", () => {
  const r = run(
    makeRoot({
      "sample/design.md": t =>
        chapter(() => "- なし\n")(
          t.replace(/\| `src\/components\/layout\/Header.tsx`.*\n/, ""),
        ),
    }),
  )
  assert.deepEqual(r.findings, [])
})

test("図の行は F-D10 の行数に数えない", () => {
  const filler = "  %% 補足\n".repeat(320)
  const r = run(
    makeRoot({
      "sample/design.md": rep(
        "  Header --> NotificationBadge\n",
        filler + "  Header --> NotificationBadge\n",
      ),
    }),
  )
  assert.deepEqual(r.findings, [])
})

test("図の行は W008（重複行）の対象外", () => {
  const dup = "  useUnreadCount->>unreadCount: fetchUnreadCount\n"
  const r = run(makeRoot({ "sample/design.md": rep(dup, dup + dup) }))
  assert.ok(!rulesOf(r.findings).includes("W008"), JSON.stringify(r.findings))
})

test("G014: コメント行を挟んでも構文エラーの行番号が合う", () => {
  assert.equal(depsProblem, null, depsProblem)
  const edit = rep(
    "  Header --> NotificationBadge\n",
    "  %% 補足1\n  %% 補足2\n  Header --> NotificationBadge\n  Header --> end\n",
  )
  const r = runFull(makeRoot({ "sample/design.md": edit }))
  const text = edit(fs.readFileSync(path.join(templates, "design.md"), "utf8"))
  const line = text.split("\n").indexOf("  Header --> end") + 1
  const g014 = r.findings.filter(f => f.rule === "G014")
  assert.deepEqual(
    g014.map(f => f.line),
    [line],
  )
})

test("G014: G005 の指摘がある図は構文検証の対象にしない", () => {
  assert.equal(depsProblem, null, depsProblem)
  const r = runFull(
    makeRoot({
      "sample/design.md": rep(
        "  Header --> NotificationBadge\n",
        "  Header ==> NotificationBadge\n",
      ),
    }),
  )
  assert.ok(rulesOf(r.findings).includes("G005"))
  assert.ok(!rulesOf(r.findings).includes("G014"), JSON.stringify(r.findings))
})

/** 依存を導入していない scripts のコピーを作る（nm: node_modules に置くパッケージの版） */
function scriptsWithoutDeps(nm = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "spec-scripts-"))
  roots.push(dir)
  fs.cpSync(here, dir, {
    recursive: true,
    filter: src => !src.includes("node_modules"),
  })
  for (const [name, version] of Object.entries(nm)) {
    const d = path.join(dir, "node_modules", name)
    fs.mkdirSync(d, { recursive: true })
    fs.writeFileSync(path.join(d, "package.json"), JSON.stringify({ version }))
  }
  return path.join(dir, "check-all.mjs")
}

test("依存が未導入なら導入手順を示して終了コード 1 で止まる", () => {
  const r = runWith(scriptsWithoutDeps(), makeRoot(), [])
  assert.equal(r.code, 1)
  assert.match(r.stderr, /mermaid が未導入/)
  assert.match(r.stderr, /npm ci --ignore-scripts --prefix /)
})

test("依存の版が package.json と違えば止まる", () => {
  const r = runWith(
    scriptsWithoutDeps({ mermaid: "0.0.1", jsdom: "0.0.1" }),
    makeRoot(),
    [],
  )
  assert.equal(r.code, 1)
  assert.match(r.stderr, /mermaid が 0\.0\.1（必要: /)
})

test("図がない spec は依存が未導入でも検査できる", () => {
  const root = makeRoot({
    "sample/design.md": t =>
      chapter(() => "- なし\n")(
        t.replace(/\| `src\/components\/layout\/Header.tsx`.*\n/, ""),
      ),
  })
  const r = runWith(scriptsWithoutDeps(), root, [])
  assert.equal(r.code, 0, r.stderr)
  assert.deepEqual(r.findings, [])
})

test("--no-syntax は構文検証だけを省く", () => {
  const root = makeRoot({
    "sample/design.md": rep(
      "  Header --> NotificationBadge\n",
      "  Header --> NotificationBadge\n  Header --> end\n",
    ),
  })
  const r = runWith(path.join(here, "check-all.mjs"), root, ["--no-syntax"])
  assert.ok(!rulesOf(r.findings).includes("G014"))
  assert.ok(rulesOf(r.findings).includes("G007"))
})

test("ルール定義の全 ID がテストケースで網羅されている", async () => {
  const ids = []
  for (const m of [
    "check-structure.mjs",
    "check-format.mjs",
    "check-diagram.mjs",
    "check-wording.mjs",
  ]) {
    ids.push(...Object.keys((await import(path.join(here, m))).rules))
  }
  const covered = new Set(cases.map(c => c[2]))
  assert.deepEqual(
    ids.filter(id => !covered.has(id)),
    [],
  )
})

test("spec 名を指定すると対象を絞り込める", () => {
  const root = makeRoot({ "bad/requirements.md": () => "x\n" }, ["sample"])
  assert.equal(run(root, "sample").code, 0)
  assert.equal(run(root, "missing").code, 2)
})
