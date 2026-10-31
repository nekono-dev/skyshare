/**
 * 依存規則の検査の規則部品（R1・R2・R4a・R4b・R4c）。
 *
 * 責務と処理概要:
 * - 辺の集合に規則を適用し、違反の一覧を返す。純粋な関数で、ファイルを読まない。
 * - 規則の根拠は steering（`structure.md`）の規約だけに限る（要件 10.1）。
 * - 型だけの辺にも、値の辺と同じ規則を適用する（要件 5.1）。
 */
import type { ModuleGraph, ImportEdge } from "./importGraph"
import { regionOf } from "./regions"

export type RuleId =
    | "layer"
    | "uiInLib"
    | "cycle"
    | "crossRegionRelative"
    | "relativeDepth"
    | "jsExtension"

export type Violation = {
    ruleId: RuleId
    from: string
    specifier: string
    message: string
}

/** 規則ごとの根拠（steering の節）。規則は steering の規約だけから導く（要件 10.1）。 */
export const RULE_BASIS: Record<RuleId, string> = {
    layer: "structure.md「Code Organization Principles」（依存の向き）",
    uiInLib:
        "structure.md「Code Organization Principles」（lib は UI に依存しない）",
    cycle: "structure.md「Code Organization Principles」（循環 import は作らない）",
    crossRegionRelative:
        "structure.md「Import Organization」（領域をまたぐ import は @/）",
    relativeDepth: "structure.md「Import Organization」（../ は 3 段未満）",
    jsExtension: "structure.md「Import Organization」（拡張子は付けない）",
}

const REACT_PACKAGE = /^react(-|\/|$)/

const violation = (
    ruleId: RuleId,
    edge: ImportEdge,
    message: string,
): Violation => ({
    ruleId,
    from: edge.from,
    specifier: edge.specifier,
    message,
})

/** 上位層（pages → lib → util）の向きに反する辺を見つける（R1）。 */
const layerRule = (edge: ImportEdge): Violation | null => {
    if (edge.target.kind !== "module") return null
    const to = edge.target.path
    if (
        edge.from.startsWith("src/lib/") &&
        (to.startsWith("src/components/") || to.startsWith("src/pages/"))
    ) {
        return violation(
            "layer",
            edge,
            "lib は components・pages を import しない（依存の向き）",
        )
    }
    if (
        edge.from.startsWith("src/util/") &&
        (to.startsWith("src/lib/") ||
            to.startsWith("src/components/") ||
            to.startsWith("src/pages/"))
    ) {
        return violation(
            "layer",
            edge,
            "util は上位層（lib・components・pages）を import しない",
        )
    }
    return null
}

/** lib から React 系のパッケージへの辺を見つける（R2）。 */
const uiInLibRule = (edge: ImportEdge): Violation | null => {
    if (!edge.from.startsWith("src/lib/") || edge.target.kind !== "package")
        return null
    if (!REACT_PACKAGE.test(edge.target.name)) return null
    return violation(
        "uiInLib",
        edge,
        "lib は UI のパッケージ（react 系）に依存しない",
    )
}

/** 領域をまたぐ相対 import を見つける（R4a）。 */
const crossRegionRelativeRule = (edge: ImportEdge): Violation | null => {
    if (edge.target.kind !== "module") return null
    const relative =
        edge.specifier.startsWith("./") || edge.specifier.startsWith("../")
    if (!relative) return null
    if (regionOf(edge.from) === regionOf(edge.target.path)) return null
    return violation(
        "crossRegionRelative",
        edge,
        "領域をまたぐ import は @/ で書く",
    )
}

/** `../` が 3 段以上の相対 import を見つける（R4b）。 */
const relativeDepthRule = (edge: ImportEdge): Violation | null => {
    const depth = edge.specifier
        .split("/")
        .filter(segment => segment === "..").length
    if (depth < 3) return null
    return violation("relativeDepth", edge, "../ は 3 段未満にする")
}

/** 拡張子 `.js` を付けた、src 内のモジュールへの import を見つける（R4c）。 */
const jsExtensionRule = (edge: ImportEdge): Violation | null => {
    if (edge.target.kind !== "module") return null
    if (!edge.specifier.endsWith(".js")) return null
    return violation("jsExtension", edge, "拡張子は付けない（方式の統一）")
}

const RULES = [
    layerRule,
    uiInLibRule,
    crossRegionRelativeRule,
    relativeDepthRule,
    jsExtensionRule,
]

/** R1・R2・R4a・R4b・R4c の違反を、辺の順序のまま返す。 */
export const evaluateImportRules = (graph: ModuleGraph): Violation[] => {
    const found: Violation[] = []
    for (const edge of graph.edges) {
        for (const rule of RULES) {
            const hit = rule(edge)
            if (hit) found.push(hit)
        }
    }
    return found
}
