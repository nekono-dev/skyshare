/**
 * Checks that the architecture guide documents the implemented dependency rules.
 *
 * - Uses fixed document snippets to verify mismatch detection.
 */
import { describe, expect, it } from "vitest"
import { RULE_BASIS, RULE_IDS } from "../../../scripts/architecture/rules"
import {
    readStructureChecks,
    readSteeringStructure,
} from "../support/steeringStructure"

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

describe("Dependency rule table matches RULE_IDS and RULE_BASIS", () => {
    const markdown = readSteeringStructure()

    it("the first table column matches RULE_IDS in both directions", () => {
        const table = parseRuleTable(readStructureChecks())
        expect(table.length).toBeGreaterThan(0)
        expect(diffRuleNames(table, RULE_IDS)).toEqual({
            missing: [],
            extra: [],
        })
    })

    it("names in RULE_BASIS match architecture guide headings", () => {
        expect(findUnmatchedBasisNames(RULE_BASIS, markdown)).toEqual([])
    })

    it("the shared utility and type sections are present", () => {
        expect(findMissingHeadings(markdown, REQUIRED_HEADINGS)).toEqual([])
    })

    it("the component section says layout files do not belong under src/layout", () => {
        expect(markdown.includes(LAYOUT_SENTENCE)).toBe(true)
    })

    it("no obsolete notes say implemented rules are planned or unchecked", () => {
        expect(findStaleNotes(markdown)).toEqual([])
    })

    it("reports a missing rule from the table", () => {
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

    it("reports an extra rule in the table", () => {
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

    it("detects missing headings, rationale names, and the layout statement", () => {
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

    it("detects obsolete notes that describe rules as planned or unchecked", () => {
        const fixture = [
            "- 葉と型だけの規則（`typesLeaf`・`typesOnly`）は、現時点の `npm run test:imports` では検査しない。",
            "`utilShared`・`typesLeaf`・`typesOnly` は、規則の実装の完了後に検査する（予定）。",
            "許容リストの各項目は、所有 spec と理由（`reason`）を持つ（予定: structure-checks 2.2 で）。",
            "- 無関係な行（予定の語は含むが規則名は無い）",
        ].join("\n")
        expect(findStaleNotes(fixture)).toHaveLength(3)
    })
})
