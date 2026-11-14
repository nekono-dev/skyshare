/**
 * Tests Wrangler configuration parsing and environment-specific configuration generation.
 */
import { readFileSync } from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"
import {
    buildWranglerConfig,
    hasReadCredentials,
    usesDevelopBucket,
} from "../../../scripts/config/render-wrangler.mjs"
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

// 結果の保管先（R2）は用途ごとのバケットとして、本番・develop・プレビューの名前を検査する
const surveyResultsBinding = (
    bindings: { binding: string; bucket_name?: string }[] = [],
) => bindings.find(b => b.binding === "SURVEY_RESULTS")

describe("survey results bucket declaration", () => {
    it("declares SURVEY_RESULTS for the production bucket in the template", () => {
        expect(surveyResultsBinding(template.r2_buckets)).toEqual({
            binding: "SURVEY_RESULTS",
            bucket_name: "skyshare-survey-results",
        })
    })

    it("gives the develop deployment the -develop bucket and previews the same bucket", () => {
        const out = buildWranglerConfig({
            template,
            config,
            develop: true,
            d1Ids: { "skyshare-develop": D1_ID },
        })
        expect(surveyResultsBinding(out.r2_buckets)).toEqual({
            binding: "SURVEY_RESULTS",
            bucket_name: "skyshare-survey-results-develop",
        })
        expect(surveyResultsBinding(out.previews.r2_buckets)).toEqual({
            binding: "SURVEY_RESULTS",
            bucket_name: "skyshare-survey-results-develop",
        })
    })

    it("declares a test bucket for SURVEY_RESULTS in the route test config without remote access", () => {
        const routeConfig = parseJsonc(
            readFileSync(
                path.resolve(__dirname, "../../../tests/route/wrangler.jsonc"),
                "utf8",
            ),
        )
        expect(surveyResultsBinding(routeConfig.r2_buckets)).toEqual({
            binding: "SURVEY_RESULTS",
            bucket_name: "skyshare-survey-results-test",
        })
        expect(JSON.stringify(routeConfig)).not.toContain("remote")
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

describe("survey results remote connection", () => {
    it.each([
        [
            "both credentials",
            { CLOUDFLARE_API_TOKEN: "token", CLOUDFLARE_ACCOUNT_ID: "account" },
            true,
        ],
        ["token only", { CLOUDFLARE_API_TOKEN: "token" }, false],
        ["account only", { CLOUDFLARE_ACCOUNT_ID: "account" }, false],
        [
            "blank values",
            { CLOUDFLARE_API_TOKEN: " ", CLOUDFLARE_ACCOUNT_ID: "account" },
            false,
        ],
        ["no credentials", {}, false],
    ])("recognizes %s", (_label, env, expected) => {
        expect(hasReadCredentials(env)).toBe(expected)
    })

    it.each([false, true])(
        "limits remote to SURVEY_RESULTS (develop=%s)",
        develop => {
            const out = buildWranglerConfig({
                template,
                config,
                develop,
                remote: true,
            })
            expect(
                out.r2_buckets.find(b => b.binding === "SURVEY_RESULTS"),
            ).toMatchObject({ remote: true })
            expect(
                out.r2_buckets
                    .filter(b => b.binding !== "SURVEY_RESULTS")
                    .every(b => !("remote" in b)),
            ).toBe(true)
            expect(out.previews.r2_buckets ?? []).toEqual(
                buildWranglerConfig({ template, config, develop }).previews
                    .r2_buckets ?? [],
            )
            if (develop) {
                expect(surveyResultsBinding(out.r2_buckets)?.bucket_name).toBe(
                    "skyshare-survey-results-develop",
                )
                expect(
                    surveyResultsBinding(out.r2_buckets)?.bucket_name,
                ).not.toBe("skyshare-survey-results")
            }
        },
    )

    it.each([
        ["production", false, false],
        ["production", true, true],
        ["develop", false, true],
        ["develop", true, true],
        ["e2e", false, true],
    ])(
        "chooses the bucket for config %s (develop=%s): develop bucket = %s",
        (name, develop, expected) => {
            expect(usesDevelopBucket({ name, develop })).toBe(expected)
        },
    )

    it("never points a non-production config at the production bucket when remote is on", () => {
        const out = buildWranglerConfig({
            template,
            config,
            develop: false,
            remote: true,
            remoteDevelop: usesDevelopBucket({ name: "develop" }),
        })

        const survey = surveyResultsBinding(out.r2_buckets)
        expect(survey).toMatchObject({
            bucket_name: "skyshare-survey-results-develop",
            remote: true,
        })
        expect(
            out.r2_buckets
                .filter(b => b.binding !== "SURVEY_RESULTS")
                .map(b => b.bucket_name),
        ).toEqual(
            template.r2_buckets
                .filter(b => b.binding !== "SURVEY_RESULTS")
                .map(b => b.bucket_name),
        )
    })

    it("keeps the production deployment on the production bucket when remote is on", () => {
        const out = buildWranglerConfig({
            template,
            config,
            develop: false,
            remote: true,
            remoteDevelop: usesDevelopBucket({ name: "production" }),
        })

        expect(surveyResultsBinding(out.r2_buckets)).toMatchObject({
            bucket_name: "skyshare-survey-results",
            remote: true,
        })
    })

    it("keeps the E2E-style default and explicit false output identical", () => {
        expect(
            buildWranglerConfig({ template, config, develop: false }),
        ).toEqual(
            buildWranglerConfig({
                template,
                config,
                develop: false,
                remote: false,
            }),
        )
        expect(
            JSON.stringify(
                buildWranglerConfig({ template, config, develop: false }),
            ),
        ).not.toContain('"remote"')
    })
})
