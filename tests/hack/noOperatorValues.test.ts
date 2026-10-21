/**
 * 運用者固有の値の直書きの検出。
 *
 * 責務と処理概要:
 * - OSS として別の運用者が配備できるよう、ドメイン・D1 の ID・測定 ID・運営者の連絡先が、
 *   アプリのコード・配備のテンプレート・ワークフローに書かれていないことを確かめる。
 */
import { readdirSync, readFileSync, statSync } from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"

const ROOT = path.resolve(__dirname, "../..")

/** ディレクトリ配下のファイルを再帰的に集める */
const files = (dir: string): string[] =>
    readdirSync(path.join(ROOT, dir)).flatMap(name => {
        const rel = path.join(dir, name)
        return statSync(path.join(ROOT, rel)).isDirectory() ? files(rel) : [rel]
    })

// 運用者固有の値の形（UUID・GA の測定 ID・この運用者のドメイン）
const PATTERNS = [
    /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/,
    /G-[A-Z0-9]{6,}/,
    /nekono\.dev/,
]
// lexicon の NSID（dev.nekono.skyshare.*）は運用者が違っても固定するため対象外
const strip = (text: string) => text.replaceAll(/dev\.nekono\.skyshare/g, "")

const findValues = (paths: string[]) =>
    paths.flatMap(rel => {
        const text = strip(readFileSync(path.join(ROOT, rel), "utf8"))
        return PATTERNS.filter(p => p.test(text)).map(p => `${rel}: ${p}`)
    })

describe("運用者固有の値の直書き", () => {
    it("[site-config/AC-9] ワークフローに運用者固有の値がない", () => {
        expect(findValues(files(".github/workflows"))).toEqual([])
    })

    it("[site-config/AC-10] アプリのコードと配備のテンプレート・設定に運用者固有の値がない", () => {
        expect(
            findValues([
                ...files("src").filter(f => !f.startsWith("src/client/")),
                "astro.config.mjs",
                "wrangler.template.jsonc",
                "hack/render-deploy-config.mjs",
            ]),
        ).toEqual([])
    })
})
