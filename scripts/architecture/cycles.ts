/**
 * 依存規則の検査の循環部品（R3）。
 *
 * 責務と処理概要:
 * - モジュールの有向グラフの強連結成分（Tarjan）を求め、循環に含まれる辺を違反として返す。
 * - 辺の両端が同じ成分で、成分の大きさが 2 以上のものだけを対象にする。自己参照は循環と数えない。
 * - 型だけの辺も含める（要件 5.1）。
 */
import type { ModuleGraph } from "./import-graph"
import type { Violation } from "./rules"

export const findCycleViolations = (graph: ModuleGraph): Violation[] => {
    const adjacency = new Map<string, string[]>(graph.modules.map(m => [m, []]))
    for (const edge of graph.edges) {
        if (edge.target.kind === "module" && edge.target.path !== edge.from) {
            adjacency.get(edge.from)?.push(edge.target.path)
        }
    }

    let counter = 0
    const stack: string[] = []
    const onStack = new Set<string>()
    const index = new Map<string, number>()
    const low = new Map<string, number>()
    const component = new Map<string, number>()
    let componentCount = 0

    const connect = (node: string): void => {
        index.set(node, counter)
        low.set(node, counter)
        counter++
        stack.push(node)
        onStack.add(node)
        for (const next of adjacency.get(node) ?? []) {
            if (!index.has(next)) {
                connect(next)
                low.set(node, Math.min(low.get(node) ?? 0, low.get(next) ?? 0))
            } else if (onStack.has(next)) {
                low.set(
                    node,
                    Math.min(low.get(node) ?? 0, index.get(next) ?? 0),
                )
            }
        }
        if (low.get(node) === index.get(node)) {
            let member: string | undefined
            do {
                member = stack.pop()
                if (member === undefined) break
                onStack.delete(member)
                component.set(member, componentCount)
            } while (member !== node)
            componentCount++
        }
    }

    for (const node of graph.modules) {
        if (!index.has(node)) connect(node)
    }

    const sizes = new Map<number, number>()
    for (const id of component.values()) sizes.set(id, (sizes.get(id) ?? 0) + 1)

    const found: Violation[] = []
    for (const edge of graph.edges) {
        if (edge.target.kind !== "module" || edge.target.path === edge.from)
            continue
        const from = component.get(edge.from)
        const to = component.get(edge.target.path)
        if (from === undefined || from !== to || (sizes.get(from) ?? 0) < 2)
            continue
        found.push({
            ruleId: "cycle",
            from: edge.from,
            specifier: edge.specifier,
            message: "循環 import に含まれている",
        })
    }
    return found
}
