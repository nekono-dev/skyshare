/**
 * lib/i18n と lib/settings の循環 import が無いことを確かめるテスト（src-cycles 2.1・2.2）。
 *
 * 責務と処理概要:
 * - リポジトリ全体の依存を走査し、指定の領域内にある循環（型だけの import を含む）が 0 件であることを確かめる。
 */
import path from "node:path"
import { describe, expect, it } from "vitest"
import { findCycleViolations } from "../../../scripts/architecture/cycles"
import { scanModules } from "../../../scripts/architecture/import-graph"

const repoRoot = path.resolve(__dirname, "../../..")
const graph = scanModules(repoRoot)
const cycleFiles = (prefix: string) =>
    findCycleViolations(graph)
        .map(v => v.from)
        .filter(from => from.startsWith(prefix))

describe("lib 内の循環（src-cycles）", () => {
    it("lib/i18n に循環 import が無い（要件 1.1）", () => {
        expect(cycleFiles("src/lib/i18n/")).toEqual([])
    })

    it("lib/settings に循環 import が無い（要件 2.1）", () => {
        expect(cycleFiles("src/lib/settings/")).toEqual([])
    })
})
