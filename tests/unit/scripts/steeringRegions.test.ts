/**
 * `structure.md` の領域の一覧と、実装の領域（`src/lib/`・`src/components/`）の差を検査するテスト（src-folder-layout 1.3・要件 5.1〜5.3）。
 *
 * 責務と処理概要:
 * - `src/lib/` の直下のフォルダと `.ts` ファイル、`src/components/` の直下のフォルダを、領域として数える。
 * - 各領域は、`structure.md` にバッククォートで `lib/<名前>` または `components/<名前>` の形で現れることを求める。
 * - 一覧にない領域を、差として報告する（失敗のメッセージに名前が出る）。
 * - 検査は文字列に対して行い、モジュールは import しない。
 * - 負例（検査が機能することの確認）: 固定の文書と領域の一覧を与え、一覧にない領域だけが報告されることを確かめる。
 */
import { readdirSync, readFileSync, statSync } from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"

const repoRoot = path.resolve(__dirname, "../../..")
const structurePath = path.join(repoRoot, ".kiro/steering/structure.md")

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

describe("structure.md の領域の一覧（src/lib・src/components）", () => {
    const markdown = readFileSync(structurePath, "utf8")
    const regions = regionTokens(listLibRegions(), listComponentRegions())

    it("実装の領域（lib の領域と components の領域）がすべて一覧に含まれる", () => {
        expect(findMissingRegions(markdown, regions)).toEqual([])
    })

    it("負例: 一覧にない領域を差として報告する", () => {
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
