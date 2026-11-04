/**
 * 骨格（`Baselayout`）の置き場が `src/components/layout/` の一つだけであることを静的に検査するテスト（structure-checks 4.1・要件 3.1〜3.4・6.3）。
 *
 * 責務と処理概要:
 * - 純粋関数 `findLayoutViolations` は、エントリの一覧（ファイルとフォルダの相対パス）に対して `src/layout` とその下のすべてを違反として返す（要件 3.1）。
 * - 純粋関数 `findLayoutImportViolations` は、ソースの本文（文字列）に `@/layout/` で始まる文字列リテラルを持つファイルを違反として返す（要件 3.2）。
 * - `src/` の全エントリ（ファイル・フォルダ）と、全ソース（`.ts`・`.tsx`・`.astro`）の本文を文字列として読んで、上の判定にかける。
 * - `src/components/layout/Baselayout/index.astro` が存在することを確かめる（要件 3.3）。
 * - 負例（検査が機能することの確認）: 固定のエントリの一覧と固定の本文を与え、違反だけが報告されることを確かめる（要件 3.4）。
 * - 検査はパスと文字列の走査だけを行い、対象のモジュールは実行・import しない（要件 6.3）。
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"

const repoRoot = path.resolve(__dirname, "../../..")
const baselayoutPath = "src/components/layout/Baselayout/index.astro"

/** 骨格の置き場として禁止するパス（`src/layout` 自体と、その接頭辞の下のすべて）。 */
const FORBIDDEN_PATH = "src/layout"
const FORBIDDEN_PATH_PREFIX = "src/layout/"

/** `@/layout/` で始まる文字列リテラル（引用符の直後に続く）。 */
const FORBIDDEN_IMPORT_LITERAL = /["'`]@\/layout\//

/** 検査の対象となるソースの拡張子。 */
const SOURCE_FILE = /\.(tsx?|astro)$/

/** エントリの一覧のうち、`src/layout` とその下のすべて（ファイル・フォルダ・拡張子を問わない）を違反として返す。 */
const findLayoutViolations = (paths: readonly string[]): string[] =>
    paths.filter(
        p => p === FORBIDDEN_PATH || p.startsWith(FORBIDDEN_PATH_PREFIX),
    )

/** ソースの本文（パスをキーとする）のうち、`@/layout/` で始まる文字列リテラルを持つファイルのパスを返す。 */
const findLayoutImportViolations = (
    sources: Readonly<Record<string, string>>,
): string[] =>
    Object.keys(sources).filter(p => FORBIDDEN_IMPORT_LITERAL.test(sources[p]))

/** `src/` の下のすべてのエントリ（ファイルとフォルダ。`/` 区切り、リポジトリの根からの相対）を返す。 */
const listEntries = (relativeDir = "src"): string[] =>
    readdirSync(path.join(repoRoot, relativeDir), {
        withFileTypes: true,
    }).flatMap(entry => {
        const relative = path.posix.join(relativeDir, entry.name)
        if (entry.isDirectory()) return [relative, ...listEntries(relative)]
        return [relative]
    })

/** `src/` の下の全ソースファイルの相対パスを返す（名前が `.ts` でもフォルダは含めない）。 */
const listSourceFiles = (): string[] =>
    listEntries().filter(
        e => SOURCE_FILE.test(e) && statSync(path.join(repoRoot, e)).isFile(),
    )

describe("骨格の置き場（src/layout を置かない）", () => {
    const entries = listEntries()
    const files = listSourceFiles()

    it("src/ のエントリ（ファイル・フォルダ）に src/layout の下のものはない", () => {
        expect(findLayoutViolations(entries)).toEqual([])
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

    it("負例: src/layout の下のファイルだけを違反として報告する", () => {
        const fixture = ["src/layout/Baselayout.astro", baselayoutPath]
        expect(findLayoutViolations(fixture)).toEqual([
            "src/layout/Baselayout.astro",
        ])
    })

    it("負例: css・json のファイルだけのフォルダ、空のフォルダも違反として報告する", () => {
        const fixture = [
            "src/layout",
            "src/layout/Baselayout.css",
            "src/layout/data.json",
            "src/layout/empty",
            baselayoutPath,
        ]
        expect(findLayoutViolations(fixture)).toEqual([
            "src/layout",
            "src/layout/Baselayout.css",
            "src/layout/data.json",
            "src/layout/empty",
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
