/**
 * Cloudflare の配備設定の生成（`hack/render-deploy-config.mjs`）の検証。
 *
 * 責務と処理概要:
 * - 一時ディレクトリにテンプレートを置いてスクリプトを実行し、与えたドメインが設定に入ることと、
 *   必須の値が欠けたときに異常終了することを確かめる（リポジトリの wrangler.jsonc には触れない）。
 */
import { spawnSync } from "node:child_process"
import {
    copyFileSync,
    mkdirSync,
    mkdtempSync,
    readFileSync,
    rmSync,
    symlinkSync,
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
    STAGING_HOST: "st.example.org",
}

let dir = ""
beforeEach(() => {
    dir = mkdtempSync(path.join(tmpdir(), "render-deploy-"))
    copyFileSync(
        path.join(ROOT, "wrangler.template.jsonc"),
        path.join(dir, "wrangler.template.jsonc"),
    )
    symlinkSync(path.join(ROOT, ".claude"), path.join(dir, ".claude"))
    mkdirSync(path.join(dir, "_legacy/frontend"), { recursive: true })
})
afterEach(() => rmSync(dir, { recursive: true, force: true }))

const run = (env: Record<string, string>, args: string[] = []) => {
    const result = spawnSync(
        process.execPath,
        [path.join(ROOT, "hack/render-deploy-config.mjs"), ...args],
        // 実行環境の値が混ざらないよう、PATH だけを引き継ぐ
        { cwd: dir, env: { PATH: process.env.PATH ?? "", ...env } },
    )
    const config =
        result.status === 0
            ? readFileSync(path.join(dir, "wrangler.jsonc"), "utf8")
            : ""
    return { status: result.status, stderr: String(result.stderr), config }
}

describe("render-deploy-config", () => {
    it("[site-config/AC-7] 与えたドメインが設定に入り、必須の値が欠けると異常終了する", () => {
        const { status, config } = run(ENV)
        expect(status).toBe(0)
        expect(config).toContain('"name": "skyshare"')
        expect(config).toContain('"pattern": "s.example.org"')
        expect(config).toContain('"database_name": "skyshare-schedule"')
        expect(config).toContain('"bucket_name": "skyshare-schedule-images"')
        expect(config).toContain('"previews_enabled": true')
        expect(config).not.toContain(`"pattern": "SITE_HOST"`)

        const { SITE_HOST: _h, ...missing } = ENV
        const failed = run(missing)
        expect(failed.status).not.toBe(0)
        expect(failed.stderr).toContain("SITE_HOST")
    })

    it("[site-config/AC-8] ステージングは別の Worker 名とドメインに、本番と同じ D1・R2 を使う", () => {
        const { status, config } = run(ENV, ["--staging"])
        expect(status).toBe(0)
        expect(config).toContain('"name": "skyshare-staging"')
        expect(config).toContain('"pattern": "st.example.org"')
        expect(config).toContain('"database_name": "skyshare-schedule"')
        expect(config).toContain('"bucket_name": "skyshare-schedule-images"')
        expect(config).toContain('"previews_enabled": false')

        const { STAGING_HOST: _s, ...missing } = ENV
        expect(run(missing, ["--staging"]).status).not.toBe(0)
    })
})
