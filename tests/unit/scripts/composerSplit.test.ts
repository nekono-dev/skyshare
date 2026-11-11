/**
 * Statically checks the ThreadComposer module boundaries and entry point size.
 * Uses source text and fixed negative cases without importing the modules under inspection.
 */
import { readdirSync, readFileSync } from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"

const repoRoot = path.resolve(__dirname, "../../..")
const folder = "src/components/composer/ThreadComposer"

/** Maximum number of lines allowed in the composer entry point. */
const MAX_INDEX_LINES = 750

/** Decision modules that must not import React. */
const PURE_JUDGMENT_FILES = [
    "rules/segments.ts",
    "rules/submitThread.ts",
    "rules/shareDispatch.ts",
    "rules/suggestHashtags.ts",
    "rules/entries.ts",
] as const

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

/** Direct `.ts` and `.tsx` files other than the entry point. */
const findRootViolations = (entries: readonly string[]) =>
    entries.filter(name => /\.tsx?$/.test(name) && name !== "index.tsx")

const lineCount = (source: string) =>
    source.replace(/\n$/, "").split("\n").length

const findReactImports = (source: string) =>
    [...source.matchAll(/from\s+["'](react|react-[^"']*)["']/g)].map(m => m[1])

const findComponentImports = (source: string) =>
    [
        ...source.matchAll(
            /from\s+["'](@\/components\/[^"']*|(?:\.\.\/)+[^"']*components\/[^"']*)["']/g,
        ),
    ].map(m => m[1])

const findIndexImports = (source: string) =>
    [
        ...source.matchAll(
            /from\s+["'](\.{1,2}\/(?:index)?|\.\/index|@\/components\/composer\/ThreadComposer(?:\/index)?)["']/g,
        ),
    ].map(m => m[1])

describe("Composer entry point size", () => {
    it(`index.tsx stays within ${MAX_INDEX_LINES} lines`, () => {
        expect(lineCount(read("index.tsx"))).toBeLessThanOrEqual(
            MAX_INDEX_LINES,
        )
    })
})

describe("Composer root contains only the entry point and child folders", () => {
    it("keeps hooks and decision modules out of the root", () => {
        const entries = readdirSync(path.join(repoRoot, folder))
        expect(findRootViolations(entries)).toEqual([])
    })
})

describe("Decision modules do not import React", () => {
    for (const file of PURE_JUDGMENT_FILES) {
        it(`${file} does not import React`, () => {
            expect(findReactImports(read(file))).toEqual([])
        })
    }
})

describe("Decision modules do not import components", () => {
    const ruleFiles = readdirSync(path.join(repoRoot, folder, "rules")).filter(
        name => name.endsWith(".ts"),
    )
    for (const name of ruleFiles) {
        it(`rules/${name} does not import components`, () => {
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

describe("Hooks, components, and decision modules do not import the composer entry point", () => {
    for (const file of NON_INDEX_FILES) {
        it(`${file} does not import index`, () => {
            expect(findIndexImports(read(file))).toEqual([])
        })
    }
})

describe("Negative cases report import violations", () => {
    it("reports a React import as a violation", () => {
        const sample = 'import { useState } from "react"\nexport const x = 1\n'
        expect(findReactImports(sample)).toEqual(["react"])
    })

    it("reports a react-easy-crop type import as a violation", () => {
        const sample = 'import type { Area } from "react-easy-crop"\n'
        expect(findReactImports(sample)).toEqual(["react-easy-crop"])
    })

    it("reports an import from a decision module to a component as a violation", () => {
        const sample =
            'import type { ImageEntry } from "@/components/composer/ThreadComposer/ImagePicker"\n'
        expect(findComponentImports(sample)).toEqual([
            "@/components/composer/ThreadComposer/ImagePicker",
        ])
    })

    it("reports a relative import of the composer entry point as a violation", () => {
        const sample = 'import Component from "./index"\n'
        expect(findIndexImports(sample)).toEqual(["./index"])
    })

    it("reports root-level hooks or decision modules as violations", () => {
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

    it("reports an @/ import of the composer entry point as a violation", () => {
        const sample =
            'import Component from "@/components/composer/ThreadComposer"\n'
        expect(findIndexImports(sample)).toEqual([
            "@/components/composer/ThreadComposer",
        ])
    })
})
