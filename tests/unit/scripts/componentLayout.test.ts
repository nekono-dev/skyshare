/**
 * `src/components/` の部品フォルダ外のソースファイルを静的に検査するテスト（src-folder-layout 1.2・要件 1.1・1.3・1.4）。
 *
 * 責務と処理概要:
 * - 部品フォルダ（`index.tsx` または `index.astro` を持つフォルダ）の外にある `.ts`・`.tsx`・`.astro` を検出する。
 * - 検出したファイルのうち、例外の一覧（理由つき）に載らないものを違反として報告する。
 * - 例外の一覧のファイルが実在することを確かめる（移動・削除の後に古い例外が残らないため）。
 * - 検査はファイル名の一覧（相対パス）に対して行い、モジュール自体は import しない。
 * - 負例（検査が機能することの確認）: 固定のファイル名の一覧を与え、違反だけが報告されることを確かめる。
 */
import { readdirSync } from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"

const repoRoot = path.resolve(__dirname, "../../..")
const componentsRoot = path.join(repoRoot, "src/components")

/** 部品フォルダの外にあってもよいソースファイル（`componentsRoot` からの相対パス）と理由。 */
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

/** フォルダの中の全ファイルの相対パス（`/` 区切り）を返す。 */
const listFiles = (relativeDir = ""): string[] =>
    readdirSync(path.join(componentsRoot, relativeDir), {
        withFileTypes: true,
    }).flatMap(entry => {
        const relative = path.posix.join(relativeDir, entry.name)
        return entry.isDirectory() ? listFiles(relative) : [relative]
    })

/** 部品フォルダ（index を持つフォルダ）の相対パスの集合。 */
const partFoldersOf = (files: readonly string[]) =>
    new Set(
        files.filter(f => PART_INDEX.test(f)).map(f => path.posix.dirname(f)),
    )

/** 祖先のどれかが部品フォルダならば、そのファイルは部品フォルダの中にある。 */
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

/** 部品フォルダの外にあり、例外の一覧に載らないソースファイル（違反）を返す。 */
const findOutsidePartViolations = (files: readonly string[]) => {
    const partFolders = partFoldersOf(files)
    return files.filter(
        f =>
            SOURCE_FILE.test(f) &&
            !isInsidePartFolder(f, partFolders) &&
            !(f in OUTSIDE_PART_EXCEPTIONS),
    )
}

describe("部品フォルダの外のソースファイル（src/components）", () => {
    const files = listFiles()

    it("部品フォルダの外のソースファイルは、例外の一覧に載るものだけである", () => {
        expect(findOutsidePartViolations(files)).toEqual([])
    })

    it("例外の一覧のファイルは実在する（古い例外を残さない）", () => {
        const missing = Object.keys(OUTSIDE_PART_EXCEPTIONS).filter(
            f => !files.includes(f),
        )
        expect(missing).toEqual([])
    })

    it("負例: 部品フォルダの外の新しいファイルを違反として報告する", () => {
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
