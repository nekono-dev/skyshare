/**
 * 規則 utilShared（structure-checks 3.1）の単体テスト。
 *
 * 責務と処理概要:
 * - `findUtilSharingViolations` の判定を、fixture のグラフ（ModuleGraph の値）で固定する。
 * - 負例（領域が一つ・0 件・util 内からのみ・pages 直下の二つのファイル）と正例（領域が二つ）を確かめる。
 * - tests/・scripts/ からの import は利用元に数えず、型だけの import は数えることを確かめる。
 * - 実リポジトリの `src/util/` は読まない（6.2 の範囲）。
 */
import { describe, expect, it } from "vitest"
import type {
    ImportEdge,
    ModuleGraph,
} from "../../../scripts/architecture/importGraph"
import { findUtilSharingViolations } from "../../../scripts/architecture/utilSharing"

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

describe("規則 utilShared（structure-checks 3.1）", () => {
    it("利用元の領域が一つだけなら違反（負例: 領域が一つ）", () => {
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

    it("利用元が一つもなければ違反（負例: 0 件）", () => {
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

    it("util の内からの import だけでは違反（負例: util 内からのみ）", () => {
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

    it("pages 直下の二つのファイルは同じ領域として数えるため違反（負例: pages の直下）", () => {
        const graph = graphOf([
            useUtil("src/pages/index.astro"),
            useUtil("src/pages/about.astro"),
        ])
        expect(utilViolations(graph).map(v => v.from)).toEqual([UTIL])
    })

    it("利用元の領域が二つあれば違反にしない（正例）", () => {
        const graph = graphOf([
            useUtil("src/lib/timeline/a.ts"),
            useUtil("src/components/share/Card/index.astro"),
        ])
        expect(utilViolations(graph)).toEqual([])
    })

    it("tests/・scripts/ からの import は利用元に数えない", () => {
        const graph = graphOf([
            useUtil("src/lib/timeline/a.ts"),
            useUtil("tests/unit/scripts/x.test.ts"),
            useUtil("scripts/architecture/y.ts"),
        ])
        expect(utilViolations(graph).map(v => v.from)).toEqual([UTIL])
    })

    it("型だけの import も利用元に数える", () => {
        const graph = graphOf([
            useUtil("src/lib/timeline/a.ts", true),
            useUtil("src/components/share/Card/index.astro", true),
        ])
        expect(utilViolations(graph)).toEqual([])
    })

    it("同じ領域の型だけの import と値の import は一つの領域として数える", () => {
        const graph = graphOf([
            useUtil("src/lib/timeline/a.ts", true),
            useUtil("src/lib/timeline/b.ts", false),
        ])
        expect(utilViolations(graph).map(v => v.from)).toEqual([UTIL])
    })
})
