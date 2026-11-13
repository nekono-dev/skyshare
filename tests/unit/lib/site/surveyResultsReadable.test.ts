/**
 * 結果公開機能のビルドの旗の判定を検査する。
 */
import { readFileSync } from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"
import { buildWranglerConfig } from "../../../../scripts/config/render-wrangler.mjs"
import { parseJsonc } from "../../../../scripts/lib/jsonc.mjs"
import {
    declaresReadableSurveyResults,
    surveyResultsReadableFlag,
} from "../../../../src/lib/site/surveyResultsReadable"

const template = parseJsonc(
    readFileSync(
        path.resolve(__dirname, "../../../../config/wrangler.template.jsonc"),
        "utf8",
    ),
)

const connected = {
    r2_buckets: [
        { binding: "SURVEY_RESULTS", bucket_name: "results", remote: true },
    ],
}

describe("declaresReadableSurveyResults", () => {
    it("returns true for a remotely connected SURVEY_RESULTS bucket", () => {
        expect(declaresReadableSurveyResults(connected)).toBe(true)
    })

    it("does not depend on the bucket name or on other bindings", () => {
        expect(
            declaresReadableSurveyResults({
                r2_buckets: [
                    { binding: "OTHER", remote: false },
                    { binding: "SURVEY_RESULTS", remote: true },
                ],
            }),
        ).toBe(true)
    })

    it.each([
        ["remote false", { remote: false }],
        ["remote absent", {}],
        ["remote non-boolean", { remote: "true" }],
        ["remote numeric", { remote: 1 }],
    ])("returns false when %s", (_label, bucket) => {
        expect(
            declaresReadableSurveyResults({
                r2_buckets: [
                    {
                        binding: "SURVEY_RESULTS",
                        bucket_name: "results",
                        ...bucket,
                    },
                ],
            }),
        ).toBe(false)
    })

    it.each([
        ["no config", undefined],
        ["null config", null],
        ["non-object config", "config"],
        ["missing bucket declarations", {}],
        ["non-array declarations", { r2_buckets: {} }],
        ["empty declarations", { r2_buckets: [] }],
        [
            "other binding only",
            { r2_buckets: [{ binding: "OTHER", remote: true }] },
        ],
        ["entry without binding", { r2_buckets: [{ remote: true }] }],
        ["malformed entries", { r2_buckets: [null, "entry", 1] }],
    ])("returns false for %s without throwing", (_label, config) => {
        expect(() => declaresReadableSurveyResults(config)).not.toThrow()
        expect(declaresReadableSurveyResults(config)).toBe(false)
    })

    it("does not enable the standard rendered config without remote access", () => {
        const rendered = buildWranglerConfig({
            template,
            config: { vars: {} },
            develop: false,
        })
        expect(declaresReadableSurveyResults(rendered)).toBe(false)
    })
})

describe("surveyResultsReadableFlag", () => {
    it("returns the build constant string", () => {
        expect(surveyResultsReadableFlag(connected)).toBe("true")
        expect(surveyResultsReadableFlag({ r2_buckets: [] })).toBe("false")
        expect(surveyResultsReadableFlag(undefined)).toBe("false")
    })
})
