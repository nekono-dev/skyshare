/**
 * `structure.md` の「依存規則の検査」の表・規則の根拠・置き場の節と、規則の一覧（`RULE_IDS`・`RULE_BASIS`）の整合を検査するテスト（structure-checks 5.2・要件 5.1〜5.4）。
 *
 * 責務と処理概要:
 * - 「## 依存規則の検査」の表の一列目（規則名）と `RULE_IDS` が双方向に一致することを確かめる。不足も余分も報告する。
 * - `RULE_BASIS` の「」内の名前が、`structure.md` の見出しと一致することを確かめる。
 * - `structure.md` に「共通（`src/util/`・`src/styles/`）」「型（`src/types/`）」の節があり、部品の節に骨格（`layout`）の `src/layout/` を置かない旨の一文があることを確かめる。
 * - 規則の実装が完了した後に、規則（`utilShared`・`typesLeaf`・`typesOnly`・`reason`）を「予定」「検査しない」と書く古い注が残っていないことを確かめる。
 * - 負例（検査が機能することの確認）: 規則が一つ欠けた表・余分な行を持つ表・古い注を含む文書を与え、差が報告されることを確かめる。
 * - 検査は `structure.md` の文字列に対して行う。規則の一覧（`RULE_IDS`・`RULE_BASIS`）だけを値として読む（規則の単一の正は `rules.ts`）。
 */
import { readFileSync } from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"
import { RULE_BASIS, RULE_IDS } from "../../../scripts/architecture/rules"

const repoRoot = path.resolve(__dirname, "../../..")
const structurePath = path.join(repoRoot, ".kiro/steering/structure.md")

/** 依存規則の表の見出し（節の名前）。 */
const RULES_SECTION = "## 依存規則の検査"

/** 節の見出しの名前と、部品の節の骨格の一文に必要な文字列。 */
const REQUIRED_HEADINGS = [
    "共通（`src/util/`・`src/styles/`）",
    "型（`src/types/`）",
]
const LAYOUT_SENTENCE = "`src/layout/` を置かない"

/** 古い注（規則の実装の完了後は事実と食い違う）を探す対象の規則名と `reason`。 */
const STALE_SUBJECTS = ["utilShared", "typesLeaf", "typesOnly", "reason"]
const STALE_WORDS = ["予定", "検査しない"]

/** 「## 依存規則の検査」の節の本文（次の `## ` の見出しまで）。 */
const sectionOf = (markdown: string, heading: string): string => {
    const start = markdown.indexOf(heading)
    if (start < 0) return ""
    const rest = markdown.slice(start + heading.length)
    const next = rest.search(/\n## /)
    return next < 0 ? rest : rest.slice(0, next)
}

/** 表の一列目（規則名）を、表の行の順に取り出す。ヘッダと区切り行は除く。 */
const parseRuleTable = (markdown: string): string[] =>
    sectionOf(markdown, RULES_SECTION)
        .split("\n")
        .filter(line => line.trim().startsWith("|"))
        .map(line => line.trim().split("|")[1].trim())
        .filter(cell => cell !== "規則" && !/^:?-+:?$/.test(cell))

/** 規則の一覧（`RULE_IDS`）と表の一列目の差を、不足（一覧にあって表にない）と余分（表にあって一覧にない）に分ける。 */
const diffRuleNames = (
    table: readonly string[],
    ruleIds: readonly string[],
): { missing: string[]; extra: string[] } => ({
    missing: ruleIds.filter(id => !table.includes(id)),
    extra: table.filter(name => !ruleIds.includes(name)),
})

/** `RULE_BASIS` の「」内の名前のうち、`structure.md` の見出しに一致しないものを返す。 */
const findUnmatchedBasisNames = (
    basis: Readonly<Record<string, string>>,
    markdown: string,
): string[] => {
    const headings = markdown
        .split("\n")
        .filter(line => /^#{1,6} /.test(line))
        .map(line => line.replace(/^#{1,6} /, "").trim())
    return Object.values(basis)
        .flatMap(text => [...text.matchAll(/「([^」]+)」/g)].map(m => m[1]))
        .filter(name => !headings.includes(name))
}

/** 見出し（`## ` などの節）が文書に無いものを返す。 */
const findMissingHeadings = (
    markdown: string,
    headings: readonly string[],
): string[] =>
    headings.filter(
        heading =>
            !markdown
                .split("\n")
                .some(line => /^#{1,6} /.test(line) && line.includes(heading)),
    )

/** 古い注（規則名・`reason` と「予定」「検査しない」が同じ行にある行）を返す。 */
const findStaleNotes = (markdown: string): string[] =>
    markdown
        .split("\n")
        .filter(
            line =>
                STALE_SUBJECTS.some(subject => line.includes(subject)) &&
                STALE_WORDS.some(word => line.includes(word)),
        )

describe("structure.md の依存規則の表と規則の一覧（RULE_IDS・RULE_BASIS）", () => {
    const markdown = readFileSync(structurePath, "utf8")

    it("表の一列目と RULE_IDS が双方向に一致する", () => {
        const table = parseRuleTable(markdown)
        expect(table.length).toBeGreaterThan(0)
        expect(diffRuleNames(table, RULE_IDS)).toEqual({
            missing: [],
            extra: [],
        })
    })

    it("RULE_BASIS の「」内の名前が structure.md の見出しと一致する", () => {
        expect(findUnmatchedBasisNames(RULE_BASIS, markdown)).toEqual([])
    })

    it("「共通（`src/util/`・`src/styles/`）」と「型（`src/types/`）」の節がある", () => {
        expect(findMissingHeadings(markdown, REQUIRED_HEADINGS)).toEqual([])
    })

    it("部品の節の骨格（layout）に、src/layout/ を置かない旨の一文がある", () => {
        expect(markdown.includes(LAYOUT_SENTENCE)).toBe(true)
    })

    it("規則の実装の完了後に、規則と reason を予定・検査しないと書く古い注が残っていない", () => {
        expect(findStaleNotes(markdown)).toEqual([])
    })

    it("負例: 規則が一つ欠けた表は、欠けた規則を不足として報告する", () => {
        const withoutTypesOnly = RULE_IDS.filter(id => id !== "typesOnly")
        const fixtureTable = [
            "| 規則 | 内容 | 根拠 |",
            "| --- | --- | --- |",
            ...withoutTypesOnly.map(id => `| ${id} | 内容 | 根拠 |`),
        ]
        const table = parseRuleTable(
            `${RULES_SECTION}\n\n${fixtureTable.join("\n")}\n\n## 次の節\n`,
        )
        expect(diffRuleNames(table, RULE_IDS)).toEqual({
            missing: ["typesOnly"],
            extra: [],
        })
    })

    it("負例: 余分な行を持つ表は、余分な規則名を差として報告する", () => {
        const fixtureTable = [
            "| 規則 | 内容 | 根拠 |",
            "| --- | --- | --- |",
            ...RULE_IDS.map(id => `| ${id} | 内容 | 根拠 |`),
            "| bogusRule | 内容 | 根拠 |",
        ]
        const table = parseRuleTable(
            `${RULES_SECTION}\n\n${fixtureTable.join("\n")}\n\n## 次の節\n`,
        )
        expect(diffRuleNames(table, RULE_IDS)).toEqual({
            missing: [],
            extra: ["bogusRule"],
        })
    })

    it("負例: 見出しに無い根拠の名前と、骨格の一文・節が無い文書を検出する", () => {
        const fixture = ["## Code Organization Principles", "- 部品の節"].join(
            "\n",
        )
        expect(
            findUnmatchedBasisNames(
                { layer: "structure.md「存在しない節」（依存の向き）" },
                fixture,
            ),
        ).toEqual(["存在しない節"])
        expect(findMissingHeadings(fixture, REQUIRED_HEADINGS)).toEqual(
            REQUIRED_HEADINGS,
        )
        expect(fixture.includes(LAYOUT_SENTENCE)).toBe(false)
    })

    it("負例: 古い注（予定・検査しない）の行を検出する", () => {
        const fixture = [
            "- 葉と型だけの規則（`typesLeaf`・`typesOnly`）は、現時点の `npm run test:imports` では検査しない。",
            "`utilShared`・`typesLeaf`・`typesOnly` は、規則の実装の完了後に検査する（予定）。",
            "許容リストの各項目は、所有 spec と理由（`reason`）を持つ（予定: structure-checks 2.2 で）。",
            "- 無関係な行（予定の語は含むが規則名は無い）",
        ].join("\n")
        expect(findStaleNotes(fixture)).toHaveLength(3)
    })
})
