/**
 * ビルド時のアンケート設定と保管先の宣言の判定を検証する。
 */
import { describe, expect, it } from "vitest"
import {
    declaresSurveyBindings,
    isSurveyConfigPresentAtBuild,
    surveyConfigPresentFlag,
} from "../../../../src/lib/site/surveyPresence.ts"

describe("declaresSurveyBindings", () => {
    it.each([
        ["宣言なし", {}],
        ["D1 のみ", { d1_databases: [{ binding: "DB" }] }],
        ["バケットのみ", { r2_buckets: [{ binding: "SURVEY_RESULTS" }] }],
        [
            "両方",
            {
                d1_databases: [{ binding: "DB" }],
                r2_buckets: [{ binding: "SURVEY_RESULTS" }],
            },
        ],
        [
            "D1 が配列でない",
            { d1_databases: {}, r2_buckets: [{ binding: "SURVEY_RESULTS" }] },
        ],
        [
            "バケットが配列でない",
            { d1_databases: [{ binding: "DB" }], r2_buckets: {} },
        ],
        [
            "binding が無い",
            { d1_databases: [{}], r2_buckets: [{ binding: "SURVEY_RESULTS" }] },
        ],
    ])("%s", (_label, wrangler) => {
        expect(declaresSurveyBindings(wrangler)).toBe(_label === "両方")
    })
})

describe("declaresSurveyBindings の不正な入力", () => {
    const valid = {
        d1_databases: [{ binding: "DB" }],
        r2_buckets: [{ binding: "SURVEY_RESULTS" }],
    }

    it.each([
        ["設定が null", null],
        ["設定が文字列", "wrangler"],
        ["設定が undefined", undefined],
        ["D1 の要素が null", { ...valid, d1_databases: [null] }],
        ["バケットの要素が数値", { ...valid, r2_buckets: [1] }],
        [
            "D1 の binding 名が違う",
            { ...valid, d1_databases: [{ binding: "OTHER" }] },
        ],
        [
            "バケットの binding 名が違う",
            { ...valid, r2_buckets: [{ binding: "SCHEDULE_IMAGES" }] },
        ],
    ])("%s のとき例外なく false を返す", (_name, input) => {
        expect(declaresSurveyBindings(input)).toBe(false)
    })
})

describe("surveyConfigPresentFlag", () => {
    const both = {
        d1_databases: [{ binding: "DB" }],
        r2_buckets: [{ binding: "SURVEY_RESULTS" }],
    }

    it.each([
        ["設定なし", {}, false, both, "false"],
        ["設定あり・宣言なし", { SURVEY_CONFIG: "{}" }, false, {}, "false"],
        [
            "設定あり・D1 のみ",
            { SURVEY_CONFIG: "{}" },
            false,
            { d1_databases: [{ binding: "DB" }] },
            "false",
        ],
        [
            "設定あり・バケットのみ",
            { SURVEY_CONFIG: "{}" },
            false,
            { r2_buckets: [{ binding: "SURVEY_RESULTS" }] },
            "false",
        ],
        ["設定あり・両方", { SURVEY_CONFIG: "{}" }, false, both, "true"],
        ["生成設定あり・両方", {}, true, both, "true"],
    ])("%s", (_label, env, fileExists, wrangler, expected) => {
        expect(surveyConfigPresentFlag(env, fileExists, wrangler)).toBe(
            expected,
        )
    })

    it("設定の有無の既存判定を維持する", () => {
        expect(
            isSurveyConfigPresentAtBuild({ SURVEY_CONFIG: "{}" }, false),
        ).toBe(true)
    })
})
