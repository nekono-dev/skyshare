/**
 * `src/lib/` の層の対応表（scripts/architecture/lib-layers.ts）の一致を確かめるテスト。
 *
 * 責務と処理概要:
 * - 対応表が `src/lib/` の直下の全領域（フォルダと `guestMode.ts`）を覆うことを確かめる（要件 1.1）。
 * - `libLayerOf` が対応表どおりの層を返すことを確かめる。`guestMode.ts` は業務（要件 1.1）。
 * - `structure.md` の「領域の一覧」が対応表の全領域を含むことを確かめる（要件 1.2・3.3）。
 *   層の表そのものとの一致は、structure.md の層の表の改訂（5.1）の後に確かめる。
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

describe("領域の対応表（LIB_LAYER）", () => {
    it("src/lib/ の直下の全領域（フォルダと guestMode.ts）を対応表が覆う（要件 1.1）", () => {
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

    it("対応表の各領域は基盤か業務のどちらかに分類される（要件 1.1）", () => {
        for (const layer of Object.values(LIB_LAYER)) {
            expect(["基盤", "業務"]).toContain(layer)
        }
    })

    it("libLayerOf は対応表どおりの層を返す（要件 1.1・3.3）", () => {
        for (const region of Object.keys(LIB_LAYER) as LibRegionName[]) {
            expect(libLayerOf(modulePathOf(region))).toBe(LIB_LAYER[region])
        }
    })

    it("guestMode.ts は業務を返す（要件 1.1）", () => {
        expect(libLayerOf("src/lib/guestMode.ts")).toBe("業務")
    })

    it("src/lib の外と、対応表に無い領域は null を返す", () => {
        expect(libLayerOf("src/util/time.ts")).toBeNull()
        expect(libLayerOf("src/types/post.ts")).toBeNull()
        expect(libLayerOf("src/lib/nowhere/x.ts")).toBeNull()
    })
})

describe("structure.md との一致", () => {
    const structure = readSteeringStructure()
    // 「## 領域の一覧」の節（次の見出しまで）
    const section = structure.match(/## 領域の一覧\n([\s\S]*?)\n## /)?.[1] ?? ""

    it("structure.md に「領域の一覧」の節がある", () => {
        expect(section.length).toBeGreaterThan(0)
    })

    it("領域の一覧の lib に、対応表の全領域が載っている（要件 1.2・3.3）", () => {
        const missing = (Object.keys(LIB_LAYER) as LibRegionName[]).filter(
            region =>
                region === "guestMode"
                    ? !section.includes("`lib/guestMode.ts`")
                    : !section.includes(`\`lib/${region}\``),
        )
        expect(missing).toEqual([])
    })
})
