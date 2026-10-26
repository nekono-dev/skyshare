/**
 * 表示言語の処理（`src/lib/i18n`）が、実行時の外部パッケージに依存しないことの検査。
 */
import { readdirSync, readFileSync, statSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

const I18N_ROOT = join(__dirname, "../../../src/lib/i18n")
/** 型だけの import は実行時に読み込まれないため除外する。 */
const RUNTIME_IMPORT =
    /^\s*(?:import|export)\s+(?!type\b)[^;]*?from\s+"([^"]+)"/gm
/** 実行時の依存として許容するのは、UIの土台である React だけ。 */
const ALLOWED_PACKAGES = new Set(["react"])

const collectFiles = (dir: string): string[] =>
    readdirSync(dir).flatMap(name => {
        const path = join(dir, name)
        if (statSync(path).isDirectory()) return collectFiles(path)
        return /\.tsx?$/.test(path) ? [path] : []
    })

describe("表示言語の処理の依存", () => {
    it("[i18n-locale/4.4] 表示言語の処理が、実行時に外部の翻訳用パッケージを読み込まない", () => {
        const violations: string[] = []
        for (const file of collectFiles(I18N_ROOT)) {
            const source = readFileSync(file, "utf8")
            for (const match of source.matchAll(RUNTIME_IMPORT)) {
                const specifier = match[1]
                const isInternal =
                    specifier.startsWith(".") || specifier.startsWith("@/")
                if (!isInternal && !ALLOWED_PACKAGES.has(specifier)) {
                    violations.push(`${file}: ${specifier}`)
                }
            }
        }
        expect(violations).toEqual([])
    })
})
