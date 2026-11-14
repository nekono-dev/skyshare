/**
 * アンケート機能の実行時有効判定を検証する。
 */
import { describe, expect, it } from "vitest"

import { isSurveyFeatureEnabled } from "@/lib/survey/feature"

describe("isSurveyFeatureEnabled", () => {
    it.each([
        ["D1 だけ", { DB: {} }, false],
        ["結果バケットだけ", { SURVEY_RESULTS: {} }, false],
        ["両方", { DB: {}, SURVEY_RESULTS: {} }, true],
        ["どちらも無い", {}, false],
    ])("%s のとき %s を返す", (_name, env, expected) => {
        expect(isSurveyFeatureEnabled(env)).toBe(expected)
    })
})
