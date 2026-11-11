/**
 * Statically checks that component source files stay inside component folders.
 * Checks the documented exceptions and verifies that new violations are reported.
 */
import { readdirSync } from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"

const repoRoot = path.resolve(__dirname, "../../..")
const componentsRoot = path.join(repoRoot, "src/components")

/** Source files allowed outside component folders, relative to `componentsRoot`, with reasons. */
const OUTSIDE_PART_EXCEPTIONS: Record<string, string> = {
    "i18n/useTranslation.ts":
        "翻訳の入口（表示言語のフック）。structure.md の i18n の規則",
    "i18n/renderSlots.tsx":
        "翻訳の入口（リッチな文言の描画）。structure.md の i18n の規則",
    "layout/nav/navItems.ts":
        "Sidebar と FooterNav が共有するナビゲーションの項目。どちらの子にもできない",
    "layout/nav/syncAccountAvatar.ts":
        "Sidebar と FooterNav が共有するナビゲーションの同期処理。どちらの子にもできない",
    "layout/nav/syncActiveState.ts":
        "Sidebar と FooterNav が共有するナビゲーションの同期処理。どちらの子にもできない",
    "layout/nav/syncGuestModeQuery.ts":
        "Sidebar と FooterNav が共有するナビゲーションの同期処理。どちらの子にもできない",
}

const SOURCE_FILE = /\.(tsx?|astro)$/
const PART_INDEX = /(^|\/)index\.(tsx|astro)$/

const listFiles = (relativeDir = ""): string[] =>
    readdirSync(path.join(componentsRoot, relativeDir), {
        withFileTypes: true,
    }).flatMap(entry => {
        const relative = path.posix.join(relativeDir, entry.name)
        return entry.isDirectory() ? listFiles(relative) : [relative]
    })

const partFoldersOf = (files: readonly string[]) =>
    new Set(
        files.filter(f => PART_INDEX.test(f)).map(f => path.posix.dirname(f)),
    )

const isInsidePartFolder = (file: string, partFolders: ReadonlySet<string>) => {
    for (
        let dir = path.posix.dirname(file);
        dir !== ".";
        dir = path.posix.dirname(dir)
    ) {
        if (partFolders.has(dir)) return true
    }
    return false
}

const findOutsidePartViolations = (files: readonly string[]) => {
    const partFolders = partFoldersOf(files)
    return files.filter(
        f =>
            SOURCE_FILE.test(f) &&
            !isInsidePartFolder(f, partFolders) &&
            !(f in OUTSIDE_PART_EXCEPTIONS),
    )
}

describe("Source files outside component folders", () => {
    const files = listFiles()

    it("allows only files listed as exceptions outside component folders", () => {
        expect(findOutsidePartViolations(files)).toEqual([])
    })

    it("requires every exception file to exist", () => {
        const missing = Object.keys(OUTSIDE_PART_EXCEPTIONS).filter(
            f => !files.includes(f),
        )
        expect(missing).toEqual([])
    })

    it("reports a new source file outside component folders as a violation", () => {
        const fixture = [
            "Foo/index.tsx",
            "Foo/child.ts",
            "Foo/deeper/nested.ts",
            "bar/newLoose.ts",
            "bar/Baz/index.astro",
        ]
        expect(findOutsidePartViolations(fixture)).toEqual(["bar/newLoose.ts"])
    })
})
