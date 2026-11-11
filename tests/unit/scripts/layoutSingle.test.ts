/**
 * Checks that layout components live only under `src/components/layout/`.
 *
 * - Scans source paths and text without importing page modules.
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

describe("Layout components stay under src/components/layout", () => {
    const entries = listEntries()
    const files = listSourceFiles()

    it("no src/layout entries exist in the source tree", () => {
        expect(findLayoutViolations(entries)).toEqual([])
    })

    it("no source file contains a string literal beginning with @/layout/", () => {
        const sources = Object.fromEntries(
            files.map(f => [f, readFileSync(path.join(repoRoot, f), "utf8")]),
        )
        expect(findLayoutImportViolations(sources)).toEqual([])
    })

    it("Baselayout exists under src/components/layout/", () => {
        expect(existsSync(path.join(repoRoot, baselayoutPath))).toBe(true)
    })

    it("reports only files under src/layout as violations", () => {
        const fixture = ["src/layout/Baselayout.astro", baselayoutPath]
        expect(findLayoutViolations(fixture)).toEqual([
            "src/layout/Baselayout.astro",
        ])
    })

    it("reports folders containing only CSS or JSON files and empty folders", () => {
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

    it("reports only files containing an @/layout/ string literal", () => {
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
