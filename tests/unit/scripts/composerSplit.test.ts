/**
 * 投稿フォームの分割の構造を静的に検査するテスト（src-composer-split 6.1・要件 3.1〜3.2）。
 *
 * 責務と処理概要:
 * - `ThreadComposer/` の配線（index.tsx）の行数の上限（750 行）を確かめる。
 * - 判断の関数（segments・submitThread・shareDispatch・suggestHashtags）が React を import しないことを確かめる。
 * - フック・部品・判断が、投稿フォームの本体（index.tsx）を import しないことを確かめる（循環の防止）。
 * - 検査は `node:fs` で読んだ文字列に対して行う（モジュール自体は import しない）。
 * - 負例（検査が機能することの確認）: `findReactImports` と `findIndexImports` に違反を含む固定の文字列を与え、
 *   違反として報告されることを確かめる。実ファイルは使わない。
 */
import { readdirSync, readFileSync } from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"

const repoRoot = path.resolve(__dirname, "../../..")
const folder = "src/components/composer/ThreadComposer"

/** 投稿フォームの本体の行数の上限（要件 3.1）。 */
const MAX_INDEX_LINES = 750

/** React を import してはならない判断の関数（要件 3.2）。 */
const PURE_JUDGMENT_FILES = [
    "rules/segments.ts",
    "rules/submitThread.ts",
    "rules/shareDispatch.ts",
    "rules/suggestHashtags.ts",
    "rules/entries.ts",
] as const

/** 投稿フォームの本体を import してはならないファイル（循環の防止）。 */
const NON_INDEX_FILES = [
    "rules/segments.ts",
    "rules/submitThread.ts",
    "rules/shareDispatch.ts",
    "rules/suggestHashtags.ts",
    "hooks/useDraftFlow.ts",
    "hooks/useScheduleFlow.ts",
    "hooks/useScheduleEdit.ts",
    "hooks/useThreadSubmit.ts",
    "hooks/useSuggest.ts",
    "hooks/useKeyboardRows.ts",
    "ComposerOptions/index.tsx",
    "ComposerDialogs/index.tsx",
] as const

const read = (relative: string) =>
    readFileSync(path.join(repoRoot, folder, relative), "utf8")

/** 直下の `.ts`・`.tsx` のうち、配線（index.tsx）以外のファイル（要件 1.1・3.3）。 */
const findRootViolations = (entries: readonly string[]) =>
    entries.filter(name => /\.tsx?$/.test(name) && name !== "index.tsx")

/** 行数（末尾の改行は数えない）。 */
const lineCount = (source: string) =>
    source.replace(/\n$/, "").split("\n").length

/** `react` と `react-` で始まるパッケージの import（値と型の両方）を探す。 */
const findReactImports = (source: string) =>
    [...source.matchAll(/from\s+["'](react|react-[^"']*)["']/g)].map(m => m[1])

/** 部品（`@/components/` への import、または `components/` 内への相対 import）を探す。 */
const findComponentImports = (source: string) =>
    [
        ...source.matchAll(
            /from\s+["'](@\/components\/[^"']*|(?:\.\.\/)+[^"']*components\/[^"']*)["']/g,
        ),
    ].map(m => m[1])

/** 投稿フォームの本体（`./index`・`.`・`../ThreadComposer` など）への import を探す。 */
const findIndexImports = (source: string) =>
    [
        ...source.matchAll(
            /from\s+["'](\.{1,2}\/(?:index)?|\.\/index|@\/components\/composer\/ThreadComposer(?:\/index)?)["']/g,
        ),
    ].map(m => m[1])

describe("投稿フォームの本体の行数（要件 3.1）", () => {
    it(`index.tsx は ${MAX_INDEX_LINES} 行以下である`, () => {
        expect(lineCount(read("index.tsx"))).toBeLessThanOrEqual(
            MAX_INDEX_LINES,
        )
    })
})

describe("直下は配線（index.tsx）と子フォルダだけ（要件 1.1・3.3）", () => {
    it("直下に、フック・判断の .ts が残っていない", () => {
        const entries = readdirSync(path.join(repoRoot, folder))
        expect(findRootViolations(entries)).toEqual([])
    })
})

describe("判断の関数は React を import しない（要件 3.2）", () => {
    for (const file of PURE_JUDGMENT_FILES) {
        it(`${file} は react を import しない`, () => {
            expect(findReactImports(read(file))).toEqual([])
        })
    }
})

describe("判断の層（rules/）は部品を import しない（部品が rules/ を参照する向きを保つ）", () => {
    const ruleFiles = readdirSync(path.join(repoRoot, folder, "rules")).filter(
        name => name.endsWith(".ts"),
    )
    for (const name of ruleFiles) {
        it(`rules/${name} は部品を import しない`, () => {
            expect(
                findComponentImports(
                    readFileSync(
                        path.join(repoRoot, folder, "rules", name),
                        "utf8",
                    ),
                ),
            ).toEqual([])
        })
    }
})

describe("フック・部品・判断は投稿フォームの本体を import しない（循環の防止）", () => {
    for (const file of NON_INDEX_FILES) {
        it(`${file} は index を import しない`, () => {
            expect(findIndexImports(read(file))).toEqual([])
        })
    }
})

describe("検査の負例（検査が違反を検出できることの確認）", () => {
    it("react の import を違反として報告する", () => {
        const sample = 'import { useState } from "react"\nexport const x = 1\n'
        expect(findReactImports(sample)).toEqual(["react"])
    })

    it("react-easy-crop の型の import も違反として報告する", () => {
        const sample = 'import type { Area } from "react-easy-crop"\n'
        expect(findReactImports(sample)).toEqual(["react-easy-crop"])
    })

    it("判断の層から部品への import を違反として報告する", () => {
        const sample =
            'import type { ImageEntry } from "@/components/composer/ThreadComposer/ImagePicker"\n'
        expect(findComponentImports(sample)).toEqual([
            "@/components/composer/ThreadComposer/ImagePicker",
        ])
    })

    it("投稿フォームの本体への相対の import を違反として報告する", () => {
        const sample = 'import Component from "./index"\n'
        expect(findIndexImports(sample)).toEqual(["./index"])
    })

    it("直下にフック・判断の .ts を置いた場合を違反として報告する", () => {
        const sample = [
            "index.tsx",
            "index.module.css",
            "useDraftFlow.ts",
            "segments.ts",
            "hooks",
        ]
        expect(findRootViolations(sample)).toEqual([
            "useDraftFlow.ts",
            "segments.ts",
        ])
    })

    it("投稿フォームの本体への @/ の import を違反として報告する", () => {
        const sample =
            'import Component from "@/components/composer/ThreadComposer"\n'
        expect(findIndexImports(sample)).toEqual([
            "@/components/composer/ThreadComposer",
        ])
    })
})
