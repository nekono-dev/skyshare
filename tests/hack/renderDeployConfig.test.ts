/**
 * Cloudflare の配備設定の生成（`hack/render-deploy-config.mjs`）の検証。
 *
 * 責務と処理概要:
 * - 一時ディレクトリにテンプレートを置いてスクリプトを実行し、与えた値が設定に入ることと、
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
    ZONE_NAME: "example.org",
    SCHEDULE_D1_DATABASE_ID: "11111111-1111-1111-1111-111111111111",
    PREVIEW_D1_DATABASE_ID: "22222222-2222-2222-2222-222222222222",
    SCHEDULE_R2_BUCKET: "op-images",
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
    it("[site-config/AC-7] 与えた配備先の値が設定に入り、必須の値が欠けると異常終了する", () => {
        const { status, config } = run(ENV)
        expect(status).toBe(0)
        expect(config).toContain('"name": "skyshare"')
        expect(config).toContain('"pattern": "s.example.org"')
        expect(config).toContain('"zone_name": "example.org"')
        expect(config).toContain(ENV.SCHEDULE_D1_DATABASE_ID)
        expect(config).toContain(ENV.PREVIEW_D1_DATABASE_ID)
        expect(config).toContain('"bucket_name": "op-images"')
        expect(config).toContain('"previews_enabled": true')

        const { SCHEDULE_D1_DATABASE_ID: _id, ...missing } = ENV
        const failed = run(missing)
        expect(failed.status).not.toBe(0)
        expect(failed.stderr).toContain("SCHEDULE_D1_DATABASE_ID")
    })

    it("[site-config/AC-8] ステージングは別の Worker 名とドメインに、プレビュー用の D1・R2 を使う", () => {
        const { status, config } = run(ENV, ["--staging"])
        expect(status).toBe(0)
        expect(config).toContain('"name": "skyshare-staging"')
        expect(config).toContain('"pattern": "st.example.org"')
        expect(config).not.toContain(ENV.SCHEDULE_D1_DATABASE_ID)
        expect(config).toContain(
            '"bucket_name": "skyshare-schedule-images-preview"',
        )
        expect(config).toContain('"previews_enabled": false')

        const { STAGING_HOST: _h, ...missing } = ENV
        expect(run(missing, ["--staging"]).status).not.toBe(0)
    })
})
