// 固定の設定（テスト専用の資材）が、現在の設定の規則で有効であることを確かめる
import { describe, expect, it } from "vitest"
import { parseSurveyConfig } from "@/lib/survey/definition"
import { createValidSurveyConfig } from "../../fixtures/survey/config"

describe("survey config fixture", () => {
    it("is a valid survey config under the current rules", () => {
        expect(parseSurveyConfig(createValidSurveyConfig()).ok).toBe(true)
    })
})
