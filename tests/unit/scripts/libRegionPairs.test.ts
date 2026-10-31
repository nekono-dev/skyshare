/**
 * lib の領域どうしが双方向・長い閉路で依存しないことを確かめるテスト（src-cycles 3.1〜5.1・要件 3.1）。
 *
 * 責務と処理概要:
 * - リポジトリ全体の依存を走査し、`lib` の領域の組（A → B）を集める。
 * - 双方向の組が 0 件であることを確かめる。長さ 3 以上を含む閉路が 0 件であることも確かめる。
 * - 検査（src-import-rules）の規則は変えず、このテストで確かめる。`src/` 直下（`(root)`）は対象外。
 */
import path from "node:path"
import { describe, expect, it } from "vitest"
import { scanModules } from "../../../scripts/architecture/importGraph"
import { regionOf } from "../../../scripts/architecture/regions"

const repoRoot = path.resolve(__dirname, "../../..")

/** `lib` の領域どうしの依存（A → B）の組を集める。 */
const libRegionPairs = (): Set<string> => {
    const graph = scanModules(repoRoot)
    const pairs = new Set<string>()
    for (const edge of graph.edges) {
        if (edge.target.kind !== "module") continue
        const from = regionOf(edge.from)
        const to = regionOf(edge.target.path)
        if (!from.startsWith("lib") || !to.startsWith("lib") || from === to)
            continue
        pairs.add(`${from} -> ${to}`)
    }
    return pairs
}

describe("lib の領域どうしの依存（src-cycles）", () => {
    it("双方向の依存（A → B と B → A の両方）が 0 組である（要件 3.1）", () => {
        const pairs = libRegionPairs()
        const bidirectional = [...pairs]
            .map(pair => pair.split(" -> "))
            .filter(([a, b]) => a < b && pairs.has(`${b} -> ${a}`))
            .map(([a, b]) => `${a} <-> ${b}`)
        expect(bidirectional).toEqual([])
    })

    it("lib の領域どうしの閉路（長さ 2 以上）が 0 件である", () => {
        const adjacency = new Map<string, Set<string>>()
        for (const pair of libRegionPairs()) {
            const [from, to] = pair.split(" -> ")
            adjacency.set(from, (adjacency.get(from) ?? new Set()).add(to))
        }
        // 各領域から、自分自身へ戻る経路があるかを調べる
        const onCycle = [...adjacency.keys()].filter(start => {
            const seen = new Set<string>()
            const stack = [...(adjacency.get(start) ?? [])]
            while (stack.length > 0) {
                const node = stack.pop()!
                if (node === start) return true
                if (seen.has(node)) continue
                seen.add(node)
                stack.push(...(adjacency.get(node) ?? []))
            }
            return false
        })
        expect(onCycle).toEqual([])
    })
})
