/**
 * Checks that the shared valid survey fixture passes the current config rules.
 */
import { describe, expect, it } from "vitest"
import { parseSurveyConfig } from "@/lib/survey/definition"
import { createValidSurveyConfig } from "../../fixtures/survey/config"

describe("survey config fixture", () => {
    it("is a valid survey config under the current rules", () => {
        expect(parseSurveyConfig(createValidSurveyConfig()).ok).toBe(true)
    })
})
