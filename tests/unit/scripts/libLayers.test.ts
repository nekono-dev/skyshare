/**
 * Checks that the library layer map covers every direct library area and matches the architecture guide.
 */
import fs from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"
import {
    LIB_LAYER,
    libLayerOf,
    type LibRegionName,
} from "../../../scripts/architecture/lib-layers"
import { readSteeringStructure } from "../support/steeringStructure"

const repoRoot = path.resolve(__dirname, "../../..")
const libRoot = path.join(repoRoot, "src/lib")

/** 対応表のキーに対応する、`src/lib/` 直下の代表ファイルのパス。 */
const modulePathOf = (region: LibRegionName): string =>
    region === "guestMode"
        ? "src/lib/guestMode.ts"
        : `src/lib/${region}/index.ts`

describe("Library area layer mapping", () => {
    it("the mapping covers every direct library area, including guestMode.ts", () => {
        const actual = fs
            .readdirSync(libRoot, { withFileTypes: true })
            .flatMap(entry => {
                if (entry.isDirectory()) return [entry.name]
                if (entry.isFile() && entry.name.endsWith(".ts"))
                    return [entry.name.slice(0, -".ts".length)]
                return []
            })
            .sort()
        expect(Object.keys(LIB_LAYER).sort()).toEqual(actual)
    })

    it("each mapped area is classified as foundation or business logic", () => {
        for (const layer of Object.values(LIB_LAYER)) {
            expect(["基盤", "業務"]).toContain(layer)
        }
    })

    it("libLayerOf returns the mapped layer for each area", () => {
        for (const region of Object.keys(LIB_LAYER) as LibRegionName[]) {
            expect(libLayerOf(modulePathOf(region))).toBe(LIB_LAYER[region])
        }
    })

    it("guestMode.ts is classified as business logic", () => {
        expect(libLayerOf("src/lib/guestMode.ts")).toBe("業務")
    })

    it("returns null for paths outside src/lib and unmapped areas", () => {
        expect(libLayerOf("src/util/time.ts")).toBeNull()
        expect(libLayerOf("src/types/post.ts")).toBeNull()
        expect(libLayerOf("src/lib/nowhere/x.ts")).toBeNull()
    })
})

describe("Architecture guide consistency", () => {
    const structure = readSteeringStructure()
    // 「## 領域の一覧」の節（次の見出しまで）
    const section = structure.match(/## 領域の一覧\n([\s\S]*?)\n## /)?.[1] ?? ""

    it("the architecture guide has an area list section", () => {
        expect(section.length).toBeGreaterThan(0)
    })

    it("the architecture guide lists every mapped library area", () => {
        const missing = (Object.keys(LIB_LAYER) as LibRegionName[]).filter(
            region =>
                region === "guestMode"
                    ? !section.includes("`lib/guestMode.ts`")
                    : !section.includes(`\`lib/${region}\``),
        )
        expect(missing).toEqual([])
    })
})
