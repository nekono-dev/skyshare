/**
 * Checks that documented library and component areas match the source tree.
 *
 * - Scans text and paths without importing modules.
 */
import { readdirSync, statSync } from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"
import { readSteeringStructure } from "../support/steeringStructure"

const repoRoot = path.resolve(__dirname, "../../..")

/** 実装の領域の一覧（`lib/<名前>` と `components/<名前>` の形）。 */
const regionTokens = (
    lib: readonly string[],
    components: readonly string[],
) => [
    ...lib.map(name => `lib/${name}`),
    ...components.map(name => `components/${name}`),
]

/** 一覧（バッククォートで囲んだ名前）に現れない領域を返す。 */
const findMissingRegions = (
    markdown: string,
    regions: readonly string[],
): string[] => regions.filter(region => !markdown.includes(`\`${region}\``))

/** `src/lib/` の直下の領域（フォルダと `.ts` ファイル）の名前。 */
const listLibRegions = (): string[] => {
    const dir = path.join(repoRoot, "src/lib")
    return readdirSync(dir)
        .filter(
            name =>
                statSync(path.join(dir, name)).isDirectory() ||
                name.endsWith(".ts"),
        )
        .sort()
}

/** `src/components/` の直下の領域（フォルダ）の名前。 */
const listComponentRegions = (): string[] => {
    const dir = path.join(repoRoot, "src/components")
    return readdirSync(dir)
        .filter(name => statSync(path.join(dir, name)).isDirectory())
        .sort()
}

describe("Documented library and component areas", () => {
    const markdown = readSteeringStructure()
    const regions = regionTokens(listLibRegions(), listComponentRegions())

    it("all library and component areas appear in the list", () => {
        expect(findMissingRegions(markdown, regions)).toEqual([])
    })

    it("reports areas missing from the list", () => {
        const fixture = "- `lib/api`\n- `components/common`\n"
        expect(
            findMissingRegions(fixture, [
                "lib/api",
                "lib/guestMode.ts",
                "components/common",
                "components/layout",
            ]),
        ).toEqual(["lib/guestMode.ts", "components/layout"])
    })
})
