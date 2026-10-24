/**
 * ローカル実行の準備（`hack/prepare-local-env.mjs`）の検証。
 *
 * 責務と処理概要:
 * - 未設定のシークレットだけが生成されることと、設定済みの値は上書きされないことを確かめる。
 * - 一時ディレクトリで実行し、.dev.vars が雛形から作られることと、生成した鍵が使える形式であることを確かめる。
 */
import { spawnSync } from "node:child_process"
import {
    copyFileSync,
    mkdtempSync,
    readFileSync,
    rmSync,
    writeFileSync,
} from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { fillMissingSecrets } from "../../hack/prepare-local-env.mjs"

const ROOT = path.resolve(__dirname, "../..")
const generators = {
    A_KEY: async () => "gen-a",
    B_KEY: async () => "gen-b",
}

describe("fillMissingSecrets", () => {
    it("コメントアウトや未記載のキーだけを生成して追記する", async () => {
        const { content, filled } = await fillMissingSecrets(
            "#A_KEY=\n",
            generators,
        )
        expect(filled).toEqual(["A_KEY", "B_KEY"])
        expect(content).toContain("A_KEY='gen-a'")
        expect(content).toContain("B_KEY='gen-b'")
    })

    it("値が空の行は生成した値に置き換える", async () => {
        const { content } = await fillMissingSecrets(
            "A_KEY=\nB_KEY='x'\n",
            generators,
        )
        expect(content).toBe("A_KEY='gen-a'\nB_KEY='x'\n")
    })

    it("設定済みの値は上書きしない", async () => {
        const src = 'A_KEY=keep-a\nB_KEY="keep-b"\n'
        const { content, filled } = await fillMissingSecrets(src, generators)
        expect(filled).toEqual([])
        expect(content).toBe(src)
    })
})

describe("prepare-local-env.mjs", () => {
    let dir: string
    beforeEach(() => {
        dir = mkdtempSync(path.join(tmpdir(), "prepare-local-env-"))
        copyFileSync(
            path.join(ROOT, ".dev.vars.template"),
            path.join(dir, ".dev.vars.template"),
        )
    })
    afterEach(() => rmSync(dir, { recursive: true, force: true }))

    const run = () =>
        spawnSync("node", [path.join(ROOT, "hack/prepare-local-env.mjs")], {
            cwd: dir,
            encoding: "utf8",
        })

    it(".dev.vars を雛形から作り、2つの鍵を生成する。2回目は変更しない", () => {
        const first = run()
        expect(first.status).toBe(0)
        // 生成した値を標準出力に出さない
        expect(first.stdout).not.toMatch(/SCHEDULE_ENC_KEY='/)
        const text = readFileSync(path.join(dir, ".dev.vars"), "utf8")
        expect(text).toContain("PUBLIC_NODE_ENV=develop")
        const enc = /^SCHEDULE_ENC_KEY='(.+)'$/m.exec(text)?.[1] ?? ""
        expect(Buffer.from(enc, "base64")).toHaveLength(32)
        const jwk = JSON.parse(
            /^SCHEDULE_OAUTH_KEY='(.+)'$/m.exec(text)?.[1] ?? "",
        )
        expect(jwk).toMatchObject({ kty: "EC", crv: "P-256" })
        expect(jwk.d).toBeTruthy()
        expect(jwk.kid).toMatch(/^skyshare-/)

        expect(run().status).toBe(0)
        expect(readFileSync(path.join(dir, ".dev.vars"), "utf8")).toBe(text)
    })

    it("既存の .dev.vars の値は保つ", () => {
        writeFileSync(path.join(dir, ".dev.vars"), "SCHEDULE_ENC_KEY=mine\n")
        run()
        const text = readFileSync(path.join(dir, ".dev.vars"), "utf8")
        expect(text).toContain("SCHEDULE_ENC_KEY=mine")
        expect(text).toContain("SCHEDULE_OAUTH_KEY='")
    })
})
