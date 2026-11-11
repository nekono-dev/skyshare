/**
 * Tests that shared utility modules are used across multiple source areas.
 *
 * - Covers fixed graphs and the repository source tree.
 */
import path from "node:path"
import { describe, expect, it } from "vitest"
import type {
    ImportEdge,
    ModuleGraph,
} from "../../../scripts/architecture/import-graph"
import { scanModules } from "../../../scripts/architecture/import-graph"
import { findUtilSharingViolations } from "../../../scripts/architecture/util-sharing"

const UTIL = "src/util/format.ts"

/** `from` から `UTIL` を import する辺を作る。 */
const useUtil = (
    from: string,
    typeOnly = false,
    target = UTIL,
): ImportEdge => ({
    from,
    specifier: "@/util/format",
    typeOnly,
    target: { kind: "module", path: target },
})

/** fixture のグラフを作る。モジュールは辺の from と to から集める。 */
const graphOf = (edges: ImportEdge[], extra: string[] = []): ModuleGraph => {
    const modules = new Set<string>([UTIL, ...extra])
    for (const edge of edges) {
        modules.add(edge.from)
        if (edge.target.kind === "module") modules.add(edge.target.path)
    }
    return { modules: [...modules].sort(), edges, unresolved: [] }
}

const utilViolations = (graph: ModuleGraph) =>
    findUtilSharingViolations(graph).filter(v => v.from.startsWith("src/util/"))

describe("Utility sharing rule", () => {
    it("reports a utility used by only one area", () => {
        const graph = graphOf([
            useUtil("src/lib/timeline/a.ts"),
            useUtil("src/lib/timeline/b.ts"),
        ])
        expect(findUtilSharingViolations(graph)).toEqual([
            {
                ruleId: "utilShared",
                from: UTIL,
                specifier: "",
                message: expect.any(String),
            },
        ])
    })

    it("reports a utility with no users", () => {
        const graph = graphOf([])
        expect(findUtilSharingViolations(graph)).toEqual([
            {
                ruleId: "utilShared",
                from: UTIL,
                specifier: "",
                message: expect.any(String),
            },
        ])
    })

    it("reports a utility used only by other utilities", () => {
        // other.ts も util であり、その利用元も util 内だけなので、両方が違反になる
        const graph = graphOf(
            [useUtil("src/util/other.ts")],
            ["src/util/other.ts"],
        )
        expect(utilViolations(graph).map(v => v.from)).toEqual([
            UTIL,
            "src/util/other.ts",
        ])
    })

    it("counts files directly under pages as one area", () => {
        const graph = graphOf([
            useUtil("src/pages/index.astro"),
            useUtil("src/pages/about.astro"),
        ])
        expect(utilViolations(graph).map(v => v.from)).toEqual([UTIL])
    })

    it("allows a utility used by two areas", () => {
        const graph = graphOf([
            useUtil("src/lib/timeline/a.ts"),
            useUtil("src/components/share/Card/index.astro"),
        ])
        expect(utilViolations(graph)).toEqual([])
    })

    it("does not count imports from tests or scripts as users", () => {
        const graph = graphOf([
            useUtil("src/lib/timeline/a.ts"),
            useUtil("tests/unit/scripts/x.test.ts"),
            useUtil("scripts/architecture/y.ts"),
        ])
        expect(utilViolations(graph).map(v => v.from)).toEqual([UTIL])
    })

    it("counts type-only imports as users", () => {
        const graph = graphOf([
            useUtil("src/lib/timeline/a.ts", true),
            useUtil("src/components/share/Card/index.astro", true),
        ])
        expect(utilViolations(graph)).toEqual([])
    })

    it("includes the detected user area names in violation messages", () => {
        const one = findUtilSharingViolations(
            graphOf([useUtil("src/lib/timeline/a.ts")]),
        ).find(v => v.from === UTIL)
        expect(one?.message).toContain("lib/timeline")
        expect(one?.message).toContain("1 件")

        const none = findUtilSharingViolations(graphOf([])).find(
            v => v.from === UTIL,
        )
        expect(none?.message).toContain("なし")
        expect(none?.message).toContain("0 件")
    })

    it("counts type-only and value imports from one area as one user area", () => {
        const graph = graphOf([
            useUtil("src/lib/timeline/a.ts", true),
            useUtil("src/lib/timeline/b.ts", false),
        ])
        expect(utilViolations(graph).map(v => v.from)).toEqual([UTIL])
    })
})

// 実リポジトリの走査（6.2）。`src/util/` の各モジュールは二つ以上の領域から使われること
const repoRoot = path.resolve(__dirname, "../../..")

describe("Utility sharing in the repository", () => {
    it("there are no utility sharing violations under src/util", () => {
        const graph = scanModules(repoRoot)
        expect(findUtilSharingViolations(graph)).toEqual([])
    })
})
