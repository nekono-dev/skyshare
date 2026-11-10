/**
 * ソースのコメントの規則（先頭ヘッダの上限と禁止パターン）を検査するテスト（comment-policy）。
 *
 * 責務と処理概要:
 * - 規則の判定（ヘッダの形・箇条書きの数・禁止パターン・日付の扱い）を、固定の本文で確かめる（負例を含む）。
 * - リポジトリ全体の違反が、許容リスト（`config/comments/allowlist.json`）に記録されていることを確かめる。
 * - 許容リストの項目が、まだ違反しているか（解消済みの項目を残さない）と、所有 spec と理由を持つかを確かめる。
 */
import { existsSync, readFileSync } from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"
import {
    type AllowEntry,
    checkSource,
    FORBIDDEN_PATTERNS,
    findCommentViolations,
    headerOf,
    keyOf,
    ownerOf,
} from "../../../scripts/architecture/commentRules"

const repoRoot = path.resolve(__dirname, "../../..")
const allowlistPath = path.join(repoRoot, "config/comments/allowlist.json")
const OWNERS = [
    "comments-api-schema",
    "comments-components-pages",
    "comments-lib",
    "comments-scripts-config",
    "comments-tests",
]

const rulesOf = (rel: string, text: string) =>
    checkSource(rel, text).map(v => v.rule)

/** 許容リストの項目が持つべきフィールド（受入基準 5.1）。 */
const ENTRY_FIELDS = ["path", "rule", "owner", "reason"] as const
/** 既知の規則（`checkSource` が出す規則と対応する）。 */
const KNOWN_RULES = new Set<string>([
    "header-missing",
    "header-too-long",
    "header-too-many-bullets",
    "date",
    ...FORBIDDEN_PATTERNS.map(p => `forbidden:${p.name}`),
])

/** 形式の欠け（必須フィールドが無い・空、未知の規則）を、項目ごとに返す。 */
const formatProblems = (entries: unknown[]): string[] =>
    entries.flatMap((raw, idx) => {
        const entry = (raw ?? {}) as Record<string, unknown>
        const problems = ENTRY_FIELDS.filter(
            field =>
                typeof entry[field] !== "string" ||
                (entry[field] as string).trim() === "",
        ).map(field => `#${idx} ${field} が無い、または空`)
        if (typeof entry.rule === "string" && !KNOWN_RULES.has(entry.rule)) {
            problems.push(`#${idx} 未知の規則 ${entry.rule}`)
        }
        return problems
    })

/** 同じ `(path, rule)` の組が 2 回以上ある鍵を返す（受入基準 5.7）。 */
const duplicateKeys = (entries: AllowEntry[]): string[] => {
    const seen = new Set<string>()
    const dup = new Set<string>()
    for (const entry of entries) {
        const key = keyOf(entry.path, entry.rule)
        if (seen.has(key)) dup.add(key)
        seen.add(key)
    }
    return [...dup]
}

/** `owner` が `ownerOf(path)` と一致しない項目を返す（受入基準 5.5）。 */
const ownerMismatches = (entries: AllowEntry[]): string[] =>
    entries
        .filter(entry => entry.owner !== ownerOf(entry.path))
        .map(
            entry =>
                `${entry.path} [${entry.rule}] owner=${entry.owner} 期待=${ownerOf(entry.path)}`,
        )

describe("先頭ヘッダの規則", () => {
    it("目的を書いた先頭のブロックコメントは違反にならない", () => {
        const text =
            "/**\n * 目的を書く。\n *\n * - 制約 1\n */\nexport const a = 1\n"
        expect(rulesOf("src/lib/x.ts", text)).toEqual([])
    })

    it("先頭にブロックコメントが無いと違反（import の後のヘッダも違反）", () => {
        expect(rulesOf("src/lib/x.ts", "export const a = 1\n")).toEqual([
            "header-missing",
        ])
        const afterImport = 'import { b } from "x"\n/**\n * 目的。\n */\n'
        expect(rulesOf("src/lib/x.ts", afterImport)).toEqual(["header-missing"])
    })

    it("`//` の行コメントはヘッダとして認めない", () => {
        expect(
            rulesOf("src/lib/x.ts", "// 目的\nexport const a = 1\n"),
        ).toEqual(["header-missing"])
    })

    const headerWith = (contentLines: string[]) =>
        `/**\n${contentLines.map(s => ` * ${s}`).join("\n")}\n */\nexport const a = 1\n`

    it("内容が 6 行を超えると違反（7 行の場合）", () => {
        const text = headerWith(["目的。", "- a", "- b", "1", "2", "3", "4"])
        expect(rulesOf("src/lib/x.ts", text)).toEqual(["header-too-long"])
    })

    it("内容がちょうど 6 行なら違反にならない（上限の境界）", () => {
        const text = headerWith(["目的。", "- a", "- b", "1", "2", "3"])
        expect(rulesOf("src/lib/x.ts", text)).toEqual([])
    })

    it("箇条書きが 3 件を超えると違反（4 件で判定）", () => {
        const text = "/**\n * 目的。\n * - a\n * - b\n * - c\n * - d\n */\n"
        expect(rulesOf("src/lib/x.ts", text)).toEqual([
            "header-too-many-bullets",
        ])
    })

    it("箇条書きがちょうど 3 件なら違反にならない（上限の境界）", () => {
        const text =
            "/**\n * 目的。\n * - a\n * - b\n * - c\n */\nexport const a = 1\n"
        expect(rulesOf("src/lib/x.ts", text)).toEqual([])
    })

    it("内容が空のブロックコメント（`/**` と `*/` だけ）は、ヘッダが無いと違反", () => {
        expect(
            rulesOf("src/lib/x.ts", "/**\n */\nexport const a = 1\n"),
        ).toEqual(["header-missing"])
    })

    it("シェバン行と Astro のフロントマターの後のヘッダは認める", () => {
        expect(
            rulesOf(
                "scripts/x.mjs",
                "#!/usr/bin/env node\n/**\n * 目的。\n */\n",
            ),
        ).toEqual([])
        expect(
            rulesOf(
                "src/pages/x.astro",
                "---\n/**\n * 目的。\n */\nimport A from './a.astro'\n---\n",
            ),
        ).toEqual([])
    })

    it("headerOf は、ヘッダの開始行と内容を返す", () => {
        const found = headerOf(["/**", " * 目的。", " * - 制約", " */"])
        expect(found).toEqual({ start: 1, content: ["目的。", "- 制約"] })
    })
})

describe("禁止パターン", () => {
    it.each([
        ["spec参照", "// 詳細は specs/entry-api を参照"],
        ["要件番号", " * 要件 2.1 の範囲"],
        ["AC/FR/NFRタグ", "// [spec/AC-3] を検証する"],
        ["cc-sdd", "// cc-sdd の導入で追加された"],
        ["kiro", "// kiro-review の手順に従う"],
    ])("コメント中の %s を違反にする", (name, line) => {
        expect(
            rulesOf("src/lib/x.ts", `/**\n * 目的。\n */\n${line}\n`),
        ).toEqual([`forbidden:${name}`])
    })

    it("日付はバッククォートの入力例の中だけ許す", () => {
        expect(
            rulesOf(
                "src/lib/x.ts",
                "/**\n * 目的。\n */\n// 入力 `2026-01-01` の例\n",
            ),
        ).toEqual([])
        expect(
            rulesOf(
                "src/lib/x.ts",
                "/**\n * 目的。\n */\n// 2026-10-31 に決定\n",
            ),
        ).toEqual(["date"])
    })

    it("コードの中の文字列（コメントでない行）は、API スキーマの summary・description 以外は見ない", () => {
        const code = 'const label = "specs/entry-api"\n'
        expect(rulesOf("src/lib/x.ts", `/**\n * 目的。\n */\n${code}`)).toEqual(
            [],
        )
    })

    it("API スキーマの summary・description は禁止パターンを見る", () => {
        const text =
            '/**\n * 目的。\n */\nexport const r = { summary: "要件 1.2 の一覧", description: "ok" }\n'
        expect(rulesOf("src/lib/api/schema/x.ts", text)).toEqual([
            "forbidden:要件番号",
        ])
    })

    it("API スキーマの description の行も禁止パターンを見る（summary と別の行）", () => {
        const text =
            '/**\n * 目的。\n */\nexport const r = {\n    description: "specs/entry-api の一覧",\n}\n'
        expect(rulesOf("src/lib/api/schema/x.ts", text)).toEqual([
            "forbidden:spec参照",
        ])
    })

    it("同じ規則の違反は、ファイルごとに 1 件にまとめる", () => {
        const text = "/**\n * 目的。\n */\n// specs/a\n// specs/b\n"
        expect(checkSource("src/lib/x.ts", text)).toHaveLength(1)
    })
})

describe("所有 spec の割り当て", () => {
    it("パスから、解消を担当する spec を決める", () => {
        expect(ownerOf("src/lib/api/schema/v2/x.ts")).toBe(
            "comments-api-schema",
        )
        expect(ownerOf("src/lib/timeline/posts.ts")).toBe("comments-lib")
        expect(ownerOf("src/components/x/index.tsx")).toBe(
            "comments-components-pages",
        )
        expect(ownerOf("tests/unit/x.test.ts")).toBe("comments-tests")
        expect(ownerOf("config/test/vitest.unit.config.ts")).toBe(
            "comments-tests",
        )
        expect(ownerOf("scripts/agent/x.mjs")).toBe("comments-scripts-config")
    })
})

describe("リポジトリ全体の違反と許容リスト", () => {
    const violations = findCommentViolations(repoRoot)
    const allow: AllowEntry[] = existsSync(allowlistPath)
        ? (
              JSON.parse(readFileSync(allowlistPath, "utf8")) as {
                  entries: AllowEntry[]
              }
          ).entries
        : []
    const allowed = new Set(allow.map(entry => keyOf(entry.path, entry.rule)))
    const violated = new Set(violations.map(v => keyOf(v.path, v.rule)))

    it("許容リストに無い違反が無い（新しい違反を増やさない）", () => {
        const unlisted = violations
            .filter(v => !allowed.has(keyOf(v.path, v.rule)))
            .map(v => `${v.path}:${v.line} [${v.rule}] ${v.detail}`)
        expect(unlisted).toEqual([])
    })

    it("許容リストの項目は、まだ違反している（解消した項目は消す）", () => {
        const stale = allow
            .filter(entry => !violated.has(keyOf(entry.path, entry.rule)))
            .map(entry => `${entry.path} [${entry.rule}]`)
        expect(stale).toEqual([])
    })

    it("許容リストの各項目は、既知の所有 spec と理由を持つ", () => {
        const invalid = allow
            .filter(
                entry =>
                    !OWNERS.includes(entry.owner) || entry.reason.trim() === "",
            )
            .map(entry => `${entry.path} [${entry.rule}]`)
        expect(invalid).toEqual([])
    })

    it("許容リストの各項目は、path・rule・owner・reason を空でない文字列で持つ（既知の規則）", () => {
        expect(formatProblems(allow)).toEqual([])
    })

    it("許容リストに、同じ (path, rule) の組の重複が無い", () => {
        expect(duplicateKeys(allow)).toEqual([])
    })

    it("許容リストの各項目の owner は、ownerOf(path) と一致する（要件 5.5）", () => {
        expect(ownerMismatches(allow)).toEqual([])
    })
})

describe("許容リストの検査の負例（固定の項目の列）", () => {
    const sample: AllowEntry = {
        path: "src/lib/x.ts",
        rule: "header-missing",
        owner: "comments-lib",
        reason: "理由",
    }

    it("正しい項目は、形式・重複・所有 spec の違反にならない", () => {
        expect(formatProblems([sample])).toEqual([])
        expect(duplicateKeys([sample])).toEqual([])
        expect(ownerMismatches([sample])).toEqual([])
    })

    it("同じ (path, rule) の組が 2 回あると、重複として検出する", () => {
        const dup = [sample, { ...sample, reason: "別の理由" }]
        expect(duplicateKeys(dup)).toEqual([keyOf(sample.path, sample.rule)])
    })

    it("同じ path でも rule が違えば、重複にならない", () => {
        const other = { ...sample, rule: "date" as const }
        expect(duplicateKeys([sample, other])).toEqual([])
    })

    it("owner が ownerOf(path) と違うと、不一致として検出する", () => {
        const wrong = { ...sample, owner: "comments-tests" }
        expect(ownerMismatches([wrong])).toHaveLength(1)
    })

    it("必須フィールドが無い・空の項目は、形式の違反として検出する", () => {
        expect(formatProblems([{ ...sample, reason: "" }])).toHaveLength(1)
        expect(formatProblems([{ ...sample, reason: undefined }])).toHaveLength(
            1,
        )
        expect(
            formatProblems([
                { rule: sample.rule, owner: sample.owner, reason: "x" },
            ]),
        ).toHaveLength(1)
    })

    it("既知でない規則の項目は、形式の違反として検出する", () => {
        expect(
            formatProblems([{ ...sample, rule: "forbidden:未知" }]),
        ).toHaveLength(1)
    })
})
