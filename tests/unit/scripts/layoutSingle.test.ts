/**
 * 骨格（`Baselayout`）の置き場が `src/components/layout/` の一つだけであることを静的に検査するテスト（structure-checks 4.1・要件 3.1〜3.4・6.3）。
 *
 * 責務と処理概要:
 * - 純粋関数 `findLayoutViolations` は、ファイル名の一覧（相対パス）に対して `src/layout/` で始まるパスを違反として返す（要件 3.1）。
 * - 純粋関数 `findLayoutImportViolations` は、ソースの本文（文字列）に `@/layout/` で始まる文字列リテラルを持つファイルを違反として返す（要件 3.2）。
 * - `src/` の全ソース（`.ts`・`.tsx`・`.astro`）の本文を文字列として読んで、上の二つの判定にかける。
 * - `src/components/layout/Baselayout/index.astro` が存在することを確かめる（要件 3.3）。
 * - 負例（検査が機能することの確認）: 固定のファイル名の一覧と固定の本文を与え、違反だけが報告されることを確かめる（要件 3.4）。
 * - 検査はファイル名と文字列の走査だけを行い、対象のモジュールは実行・import しない（要件 6.3）。
 */
import { existsSync, readdirSync, readFileSync } from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"

const repoRoot = path.resolve(__dirname, "../../..")
const srcRoot = path.join(repoRoot, "src")
const baselayoutPath = "src/components/layout/Baselayout/index.astro"

/** 骨格の置き場として禁止する接頭辞（リポジトリの相対パス）。 */
const FORBIDDEN_PATH_PREFIX = "src/layout/"

/** `@/layout/` で始まる文字列リテラル（引用符の直後に続く）。 */
const FORBIDDEN_IMPORT_LITERAL = /["'`]@\/layout\//

/** 検査の対象となるソースの拡張子。 */
const SOURCE_FILE = /\.(tsx?|astro)$/

/** ファイル名の一覧のうち、`src/layout/` で始まるパスを違反として返す。 */
const findLayoutViolations = (paths: readonly string[]): string[] =>
    paths.filter(p => p.startsWith(FORBIDDEN_PATH_PREFIX))

/** ソースの本文（パスをキーとする）のうち、`@/layout/` で始まる文字列リテラルを持つファイルのパスを返す。 */
const findLayoutImportViolations = (
    sources: Readonly<Record<string, string>>,
): string[] =>
    Object.keys(sources).filter(p => FORBIDDEN_IMPORT_LITERAL.test(sources[p]))

/** `src/` の下の全ソースファイルの相対パス（`/` 区切り、リポジトリの根からの相対）を返す。 */
const listSourceFiles = (relativeDir = "src"): string[] =>
    readdirSync(path.join(repoRoot, relativeDir), {
        withFileTypes: true,
    }).flatMap(entry => {
        const relative = path.posix.join(relativeDir, entry.name)
        if (entry.isDirectory()) return listSourceFiles(relative)
        return SOURCE_FILE.test(relative) ? [relative] : []
    })

describe("骨格の置き場（src/layout/ を置かない）", () => {
    const files = listSourceFiles()

    it("src/ のファイル名に src/layout/ で始まるパスはない", () => {
        expect(findLayoutViolations(files)).toEqual([])
    })

    it("src/ のソースの本文に @/layout/ で始まる文字列リテラルはない", () => {
        const sources = Object.fromEntries(
            files.map(f => [f, readFileSync(path.join(repoRoot, f), "utf8")]),
        )
        expect(findLayoutImportViolations(sources)).toEqual([])
    })

    it("骨格（Baselayout）は src/components/layout/ の部品フォルダとして存在する", () => {
        expect(existsSync(path.join(repoRoot, baselayoutPath))).toBe(true)
    })

    it("負例: src/layout/ の下のファイルだけを違反として報告する", () => {
        const fixture = ["src/layout/Baselayout.astro", baselayoutPath]
        expect(findLayoutViolations(fixture)).toEqual([
            "src/layout/Baselayout.astro",
        ])
    })

    it("負例: @/layout/ の文字列リテラルを持つファイルだけを違反として報告する", () => {
        const fixture = {
            "src/pages/index.astro":
                'import Base from "@/layout/Baselayout.astro"',
            "src/components/layout/Baselayout/index.astro":
                'import Nav from "@/components/layout/nav/Nav"',
        }
        expect(findLayoutImportViolations(fixture)).toEqual([
            "src/pages/index.astro",
        ])
    })
})
