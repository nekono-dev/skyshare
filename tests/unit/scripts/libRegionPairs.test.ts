/**
 * Checks dependencies between library areas for reciprocal edges and cycles.
 *
 * - Excludes modules directly under `src/`.
 */
import path from "node:path"
import { describe, expect, it } from "vitest"
import { scanModules } from "../../../scripts/architecture/import-graph"
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

describe("Dependencies between library areas", () => {
    it("there are no reciprocal dependencies between library areas", () => {
        const pairs = libRegionPairs()
        const bidirectional = [...pairs]
            .map(pair => pair.split(" -> "))
            .filter(([a, b]) => a < b && pairs.has(`${b} -> ${a}`))
            .map(([a, b]) => `${a} <-> ${b}`)
        expect(bidirectional).toEqual([])
    })

    it("there are no cycles between library areas", () => {
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
