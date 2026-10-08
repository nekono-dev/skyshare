/**
 * 仕様書チェックスクリプトの自己テスト（node --test で実行）。
 *
 * - 雛形（templates/）がすべてのチェックを通過すること
 * - 雛形を1か所ずつ崩したとき、対応するルールが検出されること
 * - 同じ入力に対して出力が一致すること（冪等性）
 * - references/rules.md がスクリプトのルール定義と一致すること
 */
import { after, test } from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { spawnSync } from "node:child_process"
import { fileURLToPath } from "node:url"

const here = path.dirname(fileURLToPath(import.meta.url))
const skill = path.dirname(here)
const templates = path.join(skill, "templates")

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

function run(root, ...args) {
  const r = spawnSync(
    process.execPath,
    [path.join(here, "check-all.mjs"), "--root", "specs", "--json", ...args],
    {
      cwd: root,
      encoding: "utf8",
    },
  )
  return {
    code: r.status,
    findings: r.status === 2 ? [] : JSON.parse(r.stdout),
    stderr: r.stderr,
  }
}

const rulesOf = findings => [...new Set(findings.map(f => f.rule))].sort()

test("雛形はすべてのチェックを通過する", () => {
  const r = run(makeRoot())
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
  "../src/components/notification/NotificationBadge.tsx": () => "export {}\n",
  "../tests/lib/notification/unreadCount.test.ts": () =>
    'test("sample/AC-1")\ntest("sample/AC-2")\n',
  "../tests/e2e/notificationBadge.spec.ts": () => 'test("sample/AC-3")\n',
}

test("全タスク完了済みで実装・テストが揃った spec は通過する", () => {
  const r = run(makeRoot(completed))
  assert.deepEqual(r.findings, [])
})

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
    { "sample/design.md": rep("## 3. エラー処理", "## 3. 例外") },
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
          /### D-2[\s\S]*?(?=## 3)/,
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
          /## 3\. エラー処理[\s\S]*$/,
          "## 3. エラー処理\n\n失敗時は描画しない。\n",
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
]

for (const [name, edits, rule, specNames] of cases) {
  test(`${rule}: ${name}`, () => {
    const r = run(makeRoot(edits, specNames))
    assert.equal(r.code, 1, r.stderr)
    assert.ok(
      rulesOf(r.findings).includes(rule),
      `${rule} が検出されない: ${JSON.stringify(rulesOf(r.findings))}`,
    )
  })
}

test("ルール定義の全 ID がテストケースで網羅されている", async () => {
  const ids = []
  for (const m of [
    "check-structure.mjs",
    "check-format.mjs",
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
