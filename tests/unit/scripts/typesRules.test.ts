/**
 * Tests dependency rules for modules under `src/types/`.
 *
 * - Covers both fixed graphs and the repository source tree.
 */
import { readFileSync } from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"
import type {
    ImportEdge,
    ModuleGraph,
} from "../../../scripts/architecture/import-graph"
import { scanModules } from "../../../scripts/architecture/import-graph"
import { evaluateImportRules } from "../../../scripts/architecture/rules"
import { findTypesOnlyViolations } from "../../../scripts/architecture/types-only"

/** `from` から `specifier` の import 辺を作る。target はモジュールまたはパッケージ。 */
const edgeTo = (
    from: string,
    target:
        { kind: "module"; path: string } | { kind: "package"; name: string },
    typeOnly = false,
): ImportEdge => ({
    from,
    specifier: target.kind === "module" ? target.path : target.name,
    typeOnly,
    target,
})

/** 辺から fixture のグラフを作る。モジュールは辺の from と to から集める。 */
const graphOf = (edges: ImportEdge[]): ModuleGraph => {
    const modules = new Set<string>()
    for (const edge of edges) {
        modules.add(edge.from)
        if (edge.target.kind === "module") modules.add(edge.target.path)
    }
    return { modules: [...modules].sort(), edges, unresolved: [] }
}

const typesLeafViolations = (edges: ImportEdge[]) =>
    evaluateImportRules(graphOf(edges)).filter(v => v.ruleId === "typesLeaf")

describe("Type dependency rule", () => {
    it("reports a dependency from a type module to a library module", () => {
        const found = typesLeafViolations([
            edgeTo("src/types/a.ts", { kind: "module", path: "src/lib/x.ts" }),
        ])
        expect(found).toEqual([
            {
                ruleId: "typesLeaf",
                from: "src/types/a.ts",
                specifier: "src/lib/x.ts",
                message: expect.any(String),
            },
        ])
    })

    it("reports a dependency from a type module to a utility module", () => {
        const found = typesLeafViolations([
            edgeTo("src/types/a.ts", { kind: "module", path: "src/util/y.ts" }),
        ])
        expect(found).toHaveLength(1)
        expect(found[0]).toMatchObject({
            ruleId: "typesLeaf",
            from: "src/types/a.ts",
        })
    })

    it("reports a dependency from a type module to a package", () => {
        const found = typesLeafViolations([
            edgeTo("src/types/a.ts", { kind: "package", name: "zod" }),
        ])
        expect(found).toHaveLength(1)
        expect(found[0]).toMatchObject({
            ruleId: "typesLeaf",
            from: "src/types/a.ts",
            specifier: "zod",
        })
    })

    it("counts type-only import edges as violations", () => {
        const found = typesLeafViolations([
            edgeTo(
                "src/types/a.ts",
                { kind: "module", path: "src/lib/x.ts" },
                true,
            ),
        ])
        expect(found).toHaveLength(1)
    })

    it("allows dependencies between type modules", () => {
        const found = typesLeafViolations([
            edgeTo("src/types/a.ts", {
                kind: "module",
                path: "src/types/b.ts",
            }),
        ])
        expect(found).toEqual([])
    })

    it("allows dependencies from other modules to type modules", () => {
        const found = typesLeafViolations([
            edgeTo("src/lib/x.ts", { kind: "module", path: "src/types/a.ts" }),
        ])
        expect(found).toEqual([])
    })
})

// 実リポジトリの走査（6.2）。`src/types/` の型だけの辺と本文が 0 件であること
const repoRoot = path.resolve(__dirname, "../../..")

describe("Type dependencies in the repository", () => {
    const graph = scanModules(repoRoot)
    const typesFiles = graph.modules
        .filter(m => m.startsWith("src/types/") && m.endsWith(".ts"))
        .map(m => ({
            path: m,
            text: readFileSync(path.join(repoRoot, m), "utf8"),
        }))

    it("there are no type dependency violations", () => {
        const found = evaluateImportRules(graph).filter(
            v => v.ruleId === "typesLeaf",
        )
        expect(found).toEqual([])
    })

    it("there are no runtime value violations under src/types", () => {
        expect(typesFiles.length).toBeGreaterThan(0)
        expect(findTypesOnlyViolations(typesFiles)).toEqual([])
    })
})
