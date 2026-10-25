/**
 * 実アカウントE2Eの認証情報が、アプリ本体・Gitへ混入しないことの検査（specs/e2elive）。
 *
 * 責務と処理概要:
 * - アプリ本体（`src/`）に、検証用アカウントの環境変数名が現れない。
 * - 認証情報の設定ファイルとログイン状態の保存先が、Gitの無視対象である。
 * - 認証情報が無い環境では、テストの一覧にライブテストのプロジェクトが含まれない。
 */
import { execFileSync } from "node:child_process"
import { readFileSync, readdirSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

/** ディレクトリ配下の全ファイルのパスを再帰的に列挙する */
const listFiles = (dir: string): string[] =>
    readdirSync(dir, { withFileTypes: true }).flatMap(entry =>
        entry.isDirectory()
            ? listFiles(join(dir, entry.name))
            : [join(dir, entry.name)],
    )

describe("実アカウントE2Eの分離", () => {
    it("e2elive/AC-18: アプリ本体のソースに、検証用アカウントの環境変数名が含まれない", () => {
        const hits = listFiles("src").filter(file => {
            if (/\.(png|jpg|jpeg|webp|svg|ico|woff2?)$/.test(file)) return false
            return readFileSync(file, "utf8").includes("SKYSHARE_E2E")
        })
        expect(hits).toEqual([])
    })

    it("e2elive/AC-19: 認証情報の設定ファイルとログイン状態の保存先が、Gitの無視対象になっている", () => {
        for (const path of [
            ".env.e2e",
            "playwright/.auth/live.json",
            "playwright/.auth/pds.json",
            "playwright/.auth/peer.json",
        ]) {
            // 無視対象なら終了コード0（そうでなければ例外になる）
            expect(() =>
                execFileSync("git", ["check-ignore", "-q", path]),
            ).not.toThrow()
        }
    })

    it("e2elive/AC-20: 認証情報が無い環境でテストの一覧を出すと、ライブテストのプロジェクトが含まれない", () => {
        const output = execFileSync("npx", ["playwright", "test", "--list"], {
            encoding: "utf8",
            // 空文字を設定すると、設定ファイル（.env.e2e）の値で上書きされず「未設定」と同じになる
            env: {
                ...process.env,
                SKYSHARE_E2E_IDENTIFIER: "",
                SKYSHARE_E2E_APP_PASSWORD: "",
            },
            timeout: 60_000,
        })
        expect(output).toContain("[chromium]")
        expect(output).not.toContain("[live]")
        expect(output).not.toContain("[live-setup]")
    })
})
