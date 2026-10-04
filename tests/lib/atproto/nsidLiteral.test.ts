import { readFileSync, readdirSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

import { ENTRY_COLLECTION } from "@/lib/atproto/nsid"

const SCAN_ROOTS = ["src"]
const EXCLUDE_DIRS = new Set([join("src", "client")])
const EXTENSIONS = [".ts", ".tsx", ".astro"]

/** 対象ディレクトリ配下のソースファイルを再帰的に列挙する */
const listSourceFiles = (dir: string): string[] =>
    readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
        const path = join(dir, entry.name)
        if (entry.isDirectory()) {
            return EXCLUDE_DIRS.has(path) ? [] : listSourceFiles(path)
        }
        return EXTENSIONS.some(ext => entry.name.endsWith(ext)) ? [path] : []
    })

/** ブロックコメントと行コメントを除去する */
const stripComments = (source: string): string =>
    source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|\s)\/\/.*$/gm, "$1")

describe("NSIDリテラルの再混入防止", () => {
    it("src配下（生成物を除く）のコード本文にSkyshare独自NSIDのリテラルが含まれない", () => {
        // `<prefix>.entry` から `.entry` を除いた部分（例: dev.nekono.skyshare）
        const prefix = ENTRY_COLLECTION.slice(0, -".entry".length)
        const offenders = SCAN_ROOTS.flatMap(listSourceFiles).filter(file =>
            stripComments(readFileSync(file, "utf-8")).includes(prefix),
        )
        expect(offenders).toEqual([])
    })
})
