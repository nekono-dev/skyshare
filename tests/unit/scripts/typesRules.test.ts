/**
 * 規則 typesLeaf（structure-checks 3.3）の単体テスト。
 *
 * 責務と処理概要:
 * - `evaluateImportRules` に加わった辺の規則 typesLeaf を、ModuleGraph の値（fixture）で固定する。
 * - 違反（`src/types/` から、`src/types/` の外のモジュール・パッケージへの辺）と、正例（型どうし・外から型への辺）を確かめる。
 * - 型だけの辺（`import type`）も違反として数えることを確かめる。
 * - 末尾の describe で、実リポジトリの `src/types/` の辺と本文が 0 件であることを確かめる（6.2）。
 */
import { readFileSync } from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"
import type {
    ImportEdge,
    ModuleGraph,
} from "../../../scripts/architecture/importGraph"
import { scanModules } from "../../../scripts/architecture/importGraph"
import { evaluateImportRules } from "../../../scripts/architecture/rules"
import { findTypesOnlyViolations } from "../../../scripts/architecture/typesOnly"

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

describe("規則 typesLeaf（structure-checks 3.3）", () => {
    it("型から lib のモジュールへの辺を違反にする（負例: src/lib）", () => {
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

    it("型から util のモジュールへの辺を違反にする（負例: src/util）", () => {
        const found = typesLeafViolations([
            edgeTo("src/types/a.ts", { kind: "module", path: "src/util/y.ts" }),
        ])
        expect(found).toHaveLength(1)
        expect(found[0]).toMatchObject({
            ruleId: "typesLeaf",
            from: "src/types/a.ts",
        })
    })

    it("型からパッケージへの辺を違反にする（負例: パッケージ）", () => {
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

    it("型だけの辺（import type）も違反として数える", () => {
        const found = typesLeafViolations([
            edgeTo(
                "src/types/a.ts",
                { kind: "module", path: "src/lib/x.ts" },
                true,
            ),
        ])
        expect(found).toHaveLength(1)
    })

    it("型どうしの辺は違反にしない（正例: src/types 内）", () => {
        const found = typesLeafViolations([
            edgeTo("src/types/a.ts", {
                kind: "module",
                path: "src/types/b.ts",
            }),
        ])
        expect(found).toEqual([])
    })

    it("外から型への辺は違反にしない（正例: src/lib → src/types）", () => {
        const found = typesLeafViolations([
            edgeTo("src/lib/x.ts", { kind: "module", path: "src/types/a.ts" }),
        ])
        expect(found).toEqual([])
    })
})

// 実リポジトリの走査（6.2）。`src/types/` の型だけの辺と本文が 0 件であること
const repoRoot = path.resolve(__dirname, "../../..")

describe("実リポジトリの src/types/（structure-checks 6.2）", () => {
    const graph = scanModules(repoRoot)
    const typesFiles = graph.modules
        .filter(m => m.startsWith("src/types/") && m.endsWith(".ts"))
        .map(m => ({
            path: m,
            text: readFileSync(path.join(repoRoot, m), "utf8"),
        }))

    it("typesLeaf の辺が 0 件である（要件 8.5）", () => {
        const found = evaluateImportRules(graph).filter(
            v => v.ruleId === "typesLeaf",
        )
        expect(found).toEqual([])
    })

    it("src/types/ の本文に typesOnly の違反が 0 件である（要件 8.5）", () => {
        expect(typesFiles.length).toBeGreaterThan(0)
        expect(findTypesOnlyViolations(typesFiles)).toEqual([])
    })
})
