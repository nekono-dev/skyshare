/**
 * Checks that component-area decisions and the documented area list match repository usage.
 *
 * - Scans imports and paths without importing modules.
 */
import { readdirSync, readFileSync, statSync } from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"
import {
    readStructureDecisions,
    readSteeringStructure,
} from "../support/steeringStructure"

const repoRoot = path.resolve(__dirname, "../../..")
const componentsDir = path.join(repoRoot, "src/components")

/** 判断の対象の小さい部品領域。 */
const smallRegions = ["share", "feedback", "privacy", "help"]

/** 利用元の走査の対象。 */
const scanRoots = ["src", "tests", "scripts"].map(dir =>
    path.join(repoRoot, dir),
)

/** 利用元として数えるソースの拡張子。 */
const sourceExtensions = [".ts", ".tsx", ".astro", ".js", ".mjs"]

/** import・export・動的 import の指定子（引用符の中の文字列）を取り出す。 */
const importPattern = /(?:\bfrom|\bimport)\s*\(?\s*["']([^"']+)["']/g

/**
 * 利用元のラベル（`composer/ThreadComposer`・`pages/feedback.astro`・`other/...`）の集合から、統合の判断を導く。
 * 利用元が一つの親の部品フォルダにまとまるときだけ「統合する」、それ以外（二つ以上の親・`pages/` を含む・親がない）は「残す」。
 */
const decideIntegration = (labels: readonly string[]): string => {
    const unique = new Set(labels)
    if (unique.size !== 1) return "残す"
    const [only] = [...unique]
    if (only.startsWith("pages/") || only.startsWith("other/")) return "残す"
    return "統合する"
}

/** 一覧（`structure.md` の記述）と実装（フォルダ）の差を、不足（実装にあって一覧にない）と余分（一覧にあって実装にない）に分ける。 */
const diffRegionNames = (
    listed: readonly string[],
    actual: readonly string[],
): { missing: string[]; stale: string[] } => ({
    missing: actual.filter(name => !listed.includes(name)),
    stale: listed.filter(name => !actual.includes(name)),
})

/** ディレクトリの直下のフォルダの名前（ソート済み）。 */
const listDirectories = (dir: string): string[] =>
    readdirSync(dir)
        .filter(name => statSync(path.join(dir, name)).isDirectory())
        .sort()

/** 指定のディレクトリ以下の、ソースファイルの絶対パス。 */
const listSourceFiles = (dir: string): string[] =>
    readdirSync(dir).flatMap(name => {
        const full = path.join(dir, name)
        if (statSync(full).isDirectory()) return listSourceFiles(full)
        return sourceExtensions.some(ext => name.endsWith(ext)) ? [full] : []
    })

/** 指定のディレクトリ以下の、フォルダとファイルの名前の集合。 */
const listTreeNames = (dir: string): Set<string> => {
    const names = new Set<string>()
    for (const name of readdirSync(dir)) {
        names.add(name)
        const full = path.join(dir, name)
        if (statSync(full).isDirectory()) {
            for (const child of listTreeNames(full)) names.add(child)
        }
    }
    return names
}

/** import 指定子を、リポジトリ内の絶対パスに解決する。外部パッケージなど解決できないものは undefined。 */
const resolveSpecifier = (file: string, spec: string): string | undefined => {
    if (spec.startsWith("@/")) return path.join(repoRoot, "src", spec.slice(2))
    if (spec.startsWith(".")) return path.resolve(path.dirname(file), spec)
    return undefined
}

/**
 * 利用元のファイルを判断の単位のラベルにする。
 * - 対象の領域の内側からの利用は数えない（領域の内側の import は統合の条件の対象外）。
 * - `src/components/<領域>/<部品>/` からの利用は `<領域>/<部品>`（親の部品フォルダ）。
 * - `src/pages/` からの利用は `pages/<ファイル名>`（部品フォルダの外）。
 * - それ以外は `other/<相対パス>`。
 */
const importerLabel = (file: string, region: string): string | undefined => {
    const rel = path.relative(repoRoot, file).split(path.sep).join("/")
    if (rel.startsWith(`src/components/${region}/`)) return undefined
    const parts = rel.split("/")
    if (rel.startsWith("src/components/")) return `${parts[2]}/${parts[3]}`
    if (rel.startsWith("src/pages/")) return `pages/${parts[parts.length - 1]}`
    return `other/${rel}`
}

/** 実測の利用元のラベル（ソート済み・重複なし）。 */
const actualUsages = (region: string): string[] => {
    const labels = new Set<string>()
    const regionDir = path.join(componentsDir, region) + path.sep
    for (const file of scanRoots.flatMap(listSourceFiles)) {
        const text = readFileSync(file, "utf8")
        for (const match of text.matchAll(importPattern)) {
            const target = resolveSpecifier(file, match[1])
            if (target === undefined || !target.startsWith(regionDir)) continue
            const label = importerLabel(file, region)
            if (label !== undefined) labels.add(label)
            break
        }
    }
    return [...labels].sort()
}

type DecisionRow = {
    region: string
    parts: string
    usages: string
    decision: string
}

/** 判断の表（「### 判断の表」の節）の行を取り出す。 */
const parseDecisionRows = (markdown: string): DecisionRow[] => {
    const start = markdown.indexOf("### 判断の表")
    const end = markdown.indexOf("\n### ", start + 1)
    const section = markdown.slice(start, end === -1 ? undefined : end)
    return section
        .split("\n")
        .filter(line => line.startsWith("| `"))
        .map(line =>
            line
                .split("|")
                .slice(1, -1)
                .map(cell => cell.trim()),
        )
        .map(cells => ({
            region: cells[0].replace(/`/g, ""),
            parts: cells[1],
            usages: cells[2],
            decision: cells[3],
        }))
}

/** 「`src/components/` の領域」の節に書かれた `components/<領域>` の名前。 */
const listedComponentRegions = (markdown: string): string[] => {
    const start = markdown.indexOf("### `src/components/` の領域")
    const end = markdown.indexOf("領域を追加・削除したとき", start)
    const section = markdown.slice(start, end)
    return [...section.matchAll(/`components\/([a-zA-Z0-9]+)`/g)]
        .map(match => match[1])
        .sort()
}

const steering = readSteeringStructure()
const rows = parseDecisionRows(readStructureDecisions())

describe("Documented component areas match the source tree", () => {
    it("the component area list matches the direct folders under src/components", () => {
        const actual = listDirectories(componentsDir)
        const listed = listedComponentRegions(steering)
        expect(diffRegionNames(listed, actual)).toEqual({
            missing: [],
            stale: [],
        })
    })

    it("reports missing and extra areas in the list", () => {
        expect(
            diffRegionNames(["share", "stale"], ["share", "feedback"]),
        ).toEqual({ missing: ["feedback"], stale: ["stale"] })
    })
})

describe("Component decisions match their usage and consolidation criteria", () => {
    it("the decision table lists all four small areas and keeps each as a separate component", () => {
        const small = rows.filter(row => smallRegions.includes(row.region))
        expect(small.map(row => row.region).sort()).toEqual(
            [...smallRegions].sort(),
        )
        for (const row of small) {
            expect(row.decision).toBe("残す")
        }
    })

    it.each(smallRegions)(
        "%s table decision matches the result derived from consolidation criteria",
        region => {
            const row = rows.find(candidate => candidate.region === region)
            expect(row).toBeDefined()
            expect(decideIntegration(actualUsages(region))).toBe(row?.decision)
        },
    )

    it.each(smallRegions)(
        "%s table usage column includes every observed usage",
        region => {
            const row = rows.find(candidate => candidate.region === region)
            for (const label of actualUsages(region)) {
                expect(row?.usages).toContain(label)
            }
        },
    )

    it("all components in the decision table exist, including internationalization", () => {
        for (const row of rows) {
            const names = listTreeNames(path.join(componentsDir, row.region))
            const tokens = [...row.parts.matchAll(/`([^`]+)`/g)].map(
                match => match[1],
            )
            expect(tokens.length).toBeGreaterThan(0)
            for (const token of tokens) {
                expect(names.has(token), `${row.region} の部品 ${token}`).toBe(
                    true,
                )
            }
        }
    })

    it("the internationalization row says to keep its location and matches the source tree", () => {
        const row = rows.find(candidate => candidate.region === "i18n")
        expect(row?.decision).toBe("移動しない")
        expect(row?.parts).toContain("useTranslation.ts")
        expect(row?.parts).toContain("renderSlots.tsx")
    })

    it("detects a consolidation decision when usage comes only from pages", () => {
        const fixture = [
            "### 判断の表",
            "",
            "| 領域 | 部品 | 利用元 | 判断 | 理由 |",
            "| ---- | ---- | ------ | ---- | ---- |",
            "| `feedback` | `FeedbackForm` | `pages/feedback.astro` | 統合する | 負例 |",
            "",
            "### `common/` へ移さない理由",
        ].join("\n")
        const fixtureRows = parseDecisionRows(fixture)
        expect(fixtureRows[0].decision).toBe("統合する")
        expect(decideIntegration(["pages/feedback.astro"])).toBe("残す")
        expect(decideIntegration(["pages/feedback.astro"])).not.toBe(
            fixtureRows[0].decision,
        )
    })

    it("applies consolidation criteria to one parent, multiple parents, pages usage, and no usage", () => {
        expect(decideIntegration(["composer/ThreadComposer"])).toBe("統合する")
        expect(
            decideIntegration(["composer/ThreadComposer", "timeline/Timeline"]),
        ).toBe("残す")
        expect(
            decideIntegration(["composer/ThreadComposer", "pages/share.astro"]),
        ).toBe("残す")
        expect(decideIntegration(["pages/feedback.astro"])).toBe("残す")
        expect(decideIntegration([])).toBe("残す")
    })
})
