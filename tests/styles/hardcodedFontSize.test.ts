/**
 * コンポーネントのスタイル定義に、フォントサイズの直書きが無いことの検査（specs/design-tokens）。
 *
 * 責務と処理概要:
 * - `src` 配下のCSS・Astro・TSXから `font-size:` / `fontSize:` の指定を拾い、
 *   トークン（`var(--font-size-*)`）の参照以外が無いことを確認する。
 * - トークンの定義ファイル（`tokens.css`）は直書きが目的のため対象外とする。
 */
import { readdirSync, readFileSync, statSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

const SRC_ROOT = join(__dirname, "../../src")
const TARGET_EXTENSIONS = [".css", ".astro", ".tsx"]
const TOKEN_DEFINITION_FILE = join("styles", "tokens.css")

const collectFiles = (dir: string): string[] =>
    readdirSync(dir).flatMap(name => {
        const path = join(dir, name)
        if (statSync(path).isDirectory()) return collectFiles(path)
        return TARGET_EXTENSIONS.some(ext => path.endsWith(ext)) ? [path] : []
    })

describe("フォントサイズの直書き", () => {
    it("[design-tokens/AC-3] コンポーネントのスタイル定義に、トークン参照以外のフォントサイズ指定が存在しない", () => {
        const violations: string[] = []
        for (const file of collectFiles(SRC_ROOT)) {
            if (file.endsWith(TOKEN_DEFINITION_FILE)) continue
            readFileSync(file, "utf8")
                .split("\n")
                .forEach((line, index) => {
                    const matched = line.match(
                        /(?:font-size|fontSize)\s*:\s*([^;,}]+)/,
                    )
                    if (!matched) return
                    if (/^\s*(var\(--font-size-|inherit\b)/.test(matched[1]))
                        return
                    violations.push(`${file}:${index + 1} ${line.trim()}`)
                })
        }
        expect(violations).toEqual([])
    })
})
