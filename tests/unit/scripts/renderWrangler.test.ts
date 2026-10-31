// wrangler.jsonc の生成（scripts/config/render-wrangler.mjs）: 設定の値の反映、公開ドメインの経路、develop 用の名前と D1・R2 の付け替え
import { readFileSync } from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"
import { buildWranglerConfig } from "../../../scripts/config/render-wrangler.mjs"
import { parseJsonc } from "../../../scripts/lib/jsonc.mjs"

const template = parseJsonc(
    readFileSync(
        path.resolve(__dirname, "../../../config/wrangler.template.jsonc"),
        "utf8",
    ),
)
const config = {
    siteHost: "skyshare.example.com",
    vars: {
        PUBLIC_NODE_ENV: "production",
        PUBLIC_PLC_DIRECTORY_BASE_URL: "https://plc.directory",
    },
}
const D1_ID = "0123abcd-0123-4abc-8def-0123456789ab"

describe("parseJsonc", () => {
    it("reads comments and trailing commas without touching URLs inside strings", () => {
        expect(
            parseJsonc(
                '{\n // c\n "a": "https://x//y", /* b */ "b": [1,2,],\n}',
            ),
        ).toEqual({ a: "https://x//y", b: [1, 2] })
    })
})

describe("buildWranglerConfig", () => {
    it("puts the configured vars at the top level and in the previews", () => {
        const out = buildWranglerConfig({ template, config, develop: false })
        expect(out.vars).toEqual(config.vars)
        expect(out.previews.vars).toEqual(config.vars)
    })

    it("routes the configured site host, and drops the routes when there is no site host", () => {
        expect(
            buildWranglerConfig({ template, config, develop: false }).routes[0]
                .pattern,
        ).toBe("skyshare.example.com")
        const local = buildWranglerConfig({
            template,
            config: { vars: config.vars },
            develop: false,
        })
        expect(local.routes).toBeUndefined()
    })

    it("names the develop deployment with the -develop suffix and previews its database by id", () => {
        const out = buildWranglerConfig({
            template,
            config,
            develop: true,
            d1Ids: { "skyshare-develop": D1_ID },
        })
        expect(out.name).toBe("skyshare-develop")
        expect(out.routes[0].pattern).toBe("develop.skyshare.example.com")
        expect(out.routes[0].previews_enabled).toBe(true)
        // 本番のドメインではプレビューを出さない
        const production = buildWranglerConfig({
            template,
            config,
            develop: false,
        })
        expect(production.routes[0].previews_enabled).toBe(false)
        expect(out.d1_databases[0].database_name).toBe("skyshare-develop")
        expect(out.r2_buckets[0].bucket_name).toBe(
            "skyshare-schedule-images-develop",
        )
        expect(out.previews.d1_databases).toEqual([
            {
                binding: "DB",
                database_name: "skyshare-develop",
                database_id: D1_ID,
            },
        ])
    })
})
