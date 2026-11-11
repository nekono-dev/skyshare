/**
 * `src/util/` の各モジュールが複数領域から共有されるか検査する。
 *
 * - `src/util/` 内部からの利用は数えず、型だけの import も対象にする。
 * - 入力は `scanModules` のグラフで、ファイルは読まない。
 */
import type { ModuleGraph } from "./import-graph"
import { regionOf } from "./regions"
import type { Violation } from "./rules"

const SRC_PREFIX = "src/"
const UTIL_PREFIX = "src/util/"

/** 利用元の領域がこの数に満たない `src/util/` のモジュールを違反にする。 */
const MIN_REGIONS = 2

export const findUtilSharingViolations = (graph: ModuleGraph): Violation[] => {
    // util の各モジュールについて、src/ の中の util 以外の利用元の領域を集める
    const regionsByUtil = new Map<string, Set<string>>()
    for (const module of graph.modules) {
        if (module.startsWith(UTIL_PREFIX)) {
            regionsByUtil.set(module, new Set<string>())
        }
    }
    for (const edge of graph.edges) {
        if (edge.target.kind !== "module") continue
        const regions = regionsByUtil.get(edge.target.path)
        if (!regions) continue
        if (!edge.from.startsWith(SRC_PREFIX)) continue
        if (edge.from.startsWith(UTIL_PREFIX)) continue
        regions.add(regionOf(edge.from))
    }

    const found: Violation[] = []
    for (const [module, regions] of regionsByUtil) {
        if (regions.size >= MIN_REGIONS) continue
        // 利用元が 0 件でも違反の理由が分かるよう「なし」と表示する。
        const names = [...regions].sort()
        const label = names.length === 0 ? "なし" : names.join(", ")
        found.push({
            ruleId: "utilShared",
            from: module,
            specifier: "",
            message: `util は二つ以上の領域から使われる（利用元の領域: ${label}、${names.length} 件）`,
        })
    }
    return found
}
