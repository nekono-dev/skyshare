/**
 * Cloudflare の配備設定の生成（`hack/render-deploy-config.mjs`）の検証。
 *
 * 責務と処理概要:
 * - 一時ディレクトリにテンプレートを置いてスクリプトを実行し、本番と develop の設定が作られることと、
 *   必須の値が欠けたときに異常終了することを確かめる（リポジトリの wrangler.jsonc には触れない）。
 * - D1 の ID の問い合わせ（`npx wrangler d1 list`）は、PATH の先頭に置いた偽のコマンドで置き換える。
 */
import { spawnSync } from "node:child_process"
import {
    chmodSync,
    copyFileSync,
    mkdirSync,
    mkdtempSync,
    readFileSync,
    rmSync,
    symlinkSync,
    writeFileSync,
} from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { afterEach, beforeEach, describe, expect, it } from "vitest"

const ROOT = path.resolve(__dirname, "../..")

const ENV = {
    PUBLIC_LEGACY_BACKEND_ENDPOINT: "https://legacy.example.org/api/v1",
    PUBLIC_DEFAULT_ATP_SERVICE: "https://api.bsky.app",
    PUBLIC_NODE_ENV: "production",
    PUBLIC_OGP_EXTRACTOR_API: "https://ogp.example.org",
    PUBLIC_PLC_DIRECTORY_BASE_URL: "https://plc.directory",
    SITE_HOST: "s.example.org",
}
// develop 用 D1 の ID（偽の npx が `wrangler d1 list` の結果として返す）
const DEVELOP_D1_ID = "33333333-3333-3333-3333-333333333333"

// D1・R2 を持つテンプレート（リポジトリのテンプレートに D1・R2 を加えたもの）
const withStorage = (template: string) =>
    template.replace(
        '  "observability": {',
        `  "d1_databases": [{ "binding": "DB", "database_name": "app-db" }],
  "r2_buckets": [{ "binding": "IMAGES", "bucket_name": "app-images" }],
  "observability": {`,
    )

let dir = ""
const template = readFileSync(
    path.join(ROOT, "wrangler.template.jsonc"),
    "utf8",
)
beforeEach(() => {
    dir = mkdtempSync(path.join(tmpdir(), "render-deploy-"))
    copyFileSync(
        path.join(ROOT, "wrangler.template.jsonc"),
        path.join(dir, "wrangler.template.jsonc"),
    )
    symlinkSync(path.join(ROOT, ".claude"), path.join(dir, ".claude"))
    mkdirSync(path.join(dir, "_legacy/frontend"), { recursive: true })
    mkdirSync(path.join(dir, "bin"))
    const fake = path.join(dir, "bin/npx")
    writeFileSync(
        fake,
        `#!/bin/sh\necho '[{"uuid":"00000000-0000-0000-0000-000000000000","name":"app-db"},{"uuid":"${DEVELOP_D1_ID}","name":"app-db-develop"}]'\n`,
    )
    chmodSync(fake, 0o755)
})
afterEach(() => rmSync(dir, { recursive: true, force: true }))

const run = (env: Record<string, string>, args: string[] = []) => {
    const result = spawnSync(
        process.execPath,
        [path.join(ROOT, "hack/render-deploy-config.mjs"), ...args],
        {
            cwd: dir,
            env: {
                PATH: `${path.join(dir, "bin")}:${process.env.PATH}`,
                ...env,
            },
        },
    )
    const config =
        result.status === 0
            ? readFileSync(path.join(dir, "wrangler.jsonc"), "utf8")
            : ""
    return { status: result.status, stderr: String(result.stderr), config }
}

describe("render-deploy-config", () => {
    it("本番は与えたドメインでプレビューを無効にし、ドメインが欠けると異常終了する", () => {
        const { status, config } = run(ENV)
        expect(status).toBe(0)
        expect(config).toContain('"name": "skyshare"')
        expect(config).toContain('"pattern": "s.example.org"')
        expect(config).toContain('"previews_enabled": false')

        const { SITE_HOST: _h, ...missing } = ENV
        const failed = run(missing)
        expect(failed.status).not.toBe(0)
        expect(failed.stderr).toContain("SITE_HOST")
    })

    it("develop は別の Worker 名と develop サブドメインにし、プレビューを有効にする", () => {
        const { status, config } = run(ENV, ["--develop"])
        expect(status).toBe(0)
        expect(config).toContain('"name": "skyshare-develop"')
        expect(config).toContain('"pattern": "develop.s.example.org"')
        expect(config).toContain('"previews_enabled": true')
    })

    it("develop は D1・R2 を develop 専用の名前にし、プレビューの D1 に名前から引いた ID を入れる", () => {
        writeFileSync(
            path.join(dir, "wrangler.template.jsonc"),
            withStorage(template),
        )
        const { status, config } = run(ENV, ["--develop"])
        expect(status).toBe(0)
        expect(config).toContain('"database_name": "app-db-develop"')
        expect(config).toContain('"bucket_name": "app-images-develop"')
        expect(config).not.toContain('"database_name": "app-db"')
        expect(config).toContain(`"database_id":"${DEVELOP_D1_ID}"`)
    })
})
