/**
 * Checks that the internationalization and settings modules have no import cycles.
 *
 * - Includes type-only imports when scanning repository dependencies.
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

describe("Import cycles between library areas", () => {
    it("has no import cycle in the internationalization area", () => {
        expect(cycleFiles("src/lib/i18n/")).toEqual([])
    })

    it("has no import cycle in the settings area", () => {
        expect(cycleFiles("src/lib/settings/")).toEqual([])
    })
})
