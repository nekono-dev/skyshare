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
} from "../../../scripts/architecture/comment-rules"

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

describe("Leading header rules", () => {
    it("accepts a leading block comment that states its purpose", () => {
        const text =
            "/**\n * 目的を書く。\n *\n * - 制約 1\n */\nexport const a = 1\n"
        expect(rulesOf("src/lib/x.ts", text)).toEqual([])
    })

    it("flags a missing leading block comment, including one after imports", () => {
        expect(rulesOf("src/lib/x.ts", "export const a = 1\n")).toEqual([
            "header-missing",
        ])
        const afterImport = 'import { b } from "x"\n/**\n * 目的。\n */\n'
        expect(rulesOf("src/lib/x.ts", afterImport)).toEqual(["header-missing"])
    })

    it("does not accept a line comment as a header", () => {
        expect(
            rulesOf("src/lib/x.ts", "// 目的\nexport const a = 1\n"),
        ).toEqual(["header-missing"])
    })

    const headerWith = (contentLines: string[]) =>
        `/**\n${contentLines.map(s => ` * ${s}`).join("\n")}\n */\nexport const a = 1\n`

    it("flags a header with more than six content lines", () => {
        const text = headerWith(["目的。", "- a", "- b", "1", "2", "3", "4"])
        expect(rulesOf("src/lib/x.ts", text)).toEqual(["header-too-long"])
    })

    it("accepts a header with exactly six content lines", () => {
        const text = headerWith(["目的。", "- a", "- b", "1", "2", "3"])
        expect(rulesOf("src/lib/x.ts", text)).toEqual([])
    })

    it("flags a header with more than three bullets", () => {
        const text = "/**\n * 目的。\n * - a\n * - b\n * - c\n * - d\n */\n"
        expect(rulesOf("src/lib/x.ts", text)).toEqual([
            "header-too-many-bullets",
        ])
    })

    it("accepts a header with exactly three bullets", () => {
        const text =
            "/**\n * 目的。\n * - a\n * - b\n * - c\n */\nexport const a = 1\n"
        expect(rulesOf("src/lib/x.ts", text)).toEqual([])
    })

    it("flags an empty block comment as a missing header", () => {
        expect(
            rulesOf("src/lib/x.ts", "/**\n */\nexport const a = 1\n"),
        ).toEqual(["header-missing"])
    })

    it("accepts a header after a shebang or Astro frontmatter", () => {
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

    it("headerOf returns the header start line and content", () => {
        const found = headerOf(["/**", " * 目的。", " * - 制約", " */"])
        expect(found).toEqual({ start: 1, content: ["目的。", "- 制約"] })
    })
})

describe("Forbidden patterns", () => {
    it.each([
        ["spec参照", "// 詳細は specs/entry-api を参照"],
        ["要件番号", " * 要件 2.1 の範囲"],
        ["AC/FR/NFRタグ", "// [spec/AC-3] を検証する"],
        ["cc-sdd", "// cc-sdd の導入で追加された"],
        ["kiro", "// kiro-review の手順に従う"],
    ])("flags forbidden pattern case %# in a comment", (name, line) => {
        expect(
            rulesOf("src/lib/x.ts", `/**\n * 目的。\n */\n${line}\n`),
        ).toEqual([`forbidden:${name}`])
    })

    it("allows dates only inside backtick-quoted examples", () => {
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

    it("ignores strings in code except API schema summaries and descriptions", () => {
        const code = 'const label = "specs/entry-api"\n'
        expect(rulesOf("src/lib/x.ts", `/**\n * 目的。\n */\n${code}`)).toEqual(
            [],
        )
    })

    it("checks API schema summaries and descriptions for forbidden patterns", () => {
        const text =
            '/**\n * 目的。\n */\nexport const r = { summary: "要件 1.2 の一覧", description: "ok" }\n'
        expect(rulesOf("src/lib/api/schema/x.ts", text)).toEqual([
            "forbidden:要件番号",
        ])
    })

    it("checks API schema description lines separately from summaries", () => {
        const text =
            '/**\n * 目的。\n */\nexport const r = {\n    description: "specs/entry-api の一覧",\n}\n'
        expect(rulesOf("src/lib/api/schema/x.ts", text)).toEqual([
            "forbidden:spec参照",
        ])
    })

    it("reports at most one violation per rule in each file", () => {
        const text = "/**\n * 目的。\n */\n// specs/a\n// specs/b\n"
        expect(checkSource("src/lib/x.ts", text)).toHaveLength(1)
    })
})

describe("Owner assignment", () => {
    it("selects the responsible owner from a path", () => {
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

describe("Repository violations and allowlist", () => {
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

    it("has no violations missing from the allowlist", () => {
        const unlisted = violations
            .filter(v => !allowed.has(keyOf(v.path, v.rule)))
            .map(v => `${v.path}:${v.line} [${v.rule}] ${v.detail}`)
        expect(unlisted).toEqual([])
    })

    it("requires every allowlist entry to match a current violation", () => {
        const stale = allow
            .filter(entry => !violated.has(keyOf(entry.path, entry.rule)))
            .map(entry => `${entry.path} [${entry.rule}]`)
        expect(stale).toEqual([])
    })

    it("requires each allowlist entry to have a known owner and a reason", () => {
        const invalid = allow
            .filter(
                entry =>
                    !OWNERS.includes(entry.owner) || entry.reason.trim() === "",
            )
            .map(entry => `${entry.path} [${entry.rule}]`)
        expect(invalid).toEqual([])
    })

    it("requires non-empty path, rule, owner, and reason fields with a known rule", () => {
        expect(formatProblems(allow)).toEqual([])
    })

    it("has no duplicate path and rule pairs in the allowlist", () => {
        expect(duplicateKeys(allow)).toEqual([])
    })

    it("requires each entry owner to match the owner assigned to its path", () => {
        expect(ownerMismatches(allow)).toEqual([])
    })
})

describe("Allowlist validation with fixed sample entries", () => {
    const sample: AllowEntry = {
        path: "src/lib/x.ts",
        rule: "header-missing",
        owner: "comments-lib",
        reason: "理由",
    }

    it("accepts a valid entry without format, duplicate, or ownership problems", () => {
        expect(formatProblems([sample])).toEqual([])
        expect(duplicateKeys([sample])).toEqual([])
        expect(ownerMismatches([sample])).toEqual([])
    })

    it("detects duplicate entries with the same path and rule", () => {
        const dup = [sample, { ...sample, reason: "別の理由" }]
        expect(duplicateKeys(dup)).toEqual([keyOf(sample.path, sample.rule)])
    })

    it("allows the same path with a different rule", () => {
        const other = { ...sample, rule: "date" as const }
        expect(duplicateKeys([sample, other])).toEqual([])
    })

    it("detects an owner that does not match the path assignment", () => {
        const wrong = { ...sample, owner: "comments-tests" }
        expect(ownerMismatches([wrong])).toHaveLength(1)
    })

    it("detects entries with missing or empty required fields", () => {
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

    it("detects entries with an unknown rule", () => {
        expect(
            formatProblems([{ ...sample, rule: "forbidden:未知" }]),
        ).toHaveLength(1)
    })
})
