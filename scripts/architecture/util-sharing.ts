/**
 * 依存規則の検査の規則 utilShared（structure-checks 3.1）。
 *
 * 責務と処理概要:
 * - `src/util/` の各モジュールについて、`src/util/` の外からの利用元の領域（`regionOf`）の集合を作る。
 * - 領域が二つ未満（0 件を含む）のモジュールを違反として返す（specifier は空文字）。
 * - 利用元は `src/` のモジュールだけを数える。`src/util/` 内からの import は数えない。
 * - 型だけの import も数える（要件 2.4）。
 * - 純粋な関数で、ファイルを読まない。
 *
 * 実装上の制約:
 * - `scanModules` が返すグラフを入力にする。`tests/`・`scripts/` は走査の対象外のため、利用元に入らない。
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
        // 見つかった領域の名前を並べ、要件 2.2 の「領域を示す」を満たす（0 件のときは「なし」）
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
