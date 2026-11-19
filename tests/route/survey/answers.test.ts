/**
 * アンケート回答 API の設定照合と保存前拒否を検証する。
 */
import { env } from "cloudflare:test"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { POST } from "@/pages/v2/surveys/[surveyId]/answers"
import { createValidSurveyConfig } from "../../fixtures/survey/config"
import { TEST_DID } from "../../fixtures/identities"

const state = vi.hoisted(() => ({ readSurveyConfig: vi.fn() }))
vi.mock("@/lib/survey/env", () => ({
    getSurveyEnv: async () => ({
        DB: env.DB,
        SURVEY_RESULTS: {},
        SURVEY_HASH_KEY: "fixture-hash-key",
    }),
}))
vi.mock("@/lib/survey/loadConfig", () => ({
    readSurveyConfig: state.readSurveyConfig,
}))

const surveyId = "survey-invalid-option-test"

describe("POST /v2/surveys/{surveyId}/answers", () => {
    beforeEach(() => {
        vi.stubEnv("PUBLIC_SURVEY_CONFIG_PRESENT", "true")
        state.readSurveyConfig.mockReset()
        state.readSurveyConfig.mockResolvedValue({
            surveys: createValidSurveyConfig().surveys.map(survey => ({
                ...survey,
                id: surveyId,
            })),
        })
    })

    afterEach(() => {
        vi.unstubAllEnvs()
    })

    it("returns 400 and saves no respondent or answer for an unknown option id", async () => {
        const response = await POST({
            request: new Request(
                `https://skyshare.test/v2/surveys/${surveyId}/answers`,
                {
                    method: "POST",
                    headers: { "content-type": "application/json" },
                    body: JSON.stringify({
                        answers: { "q-purpose": "unknown" },
                    }),
                },
            ),
            params: { surveyId },
            locals: { session: { did: TEST_DID } },
        } as never)

        expect(response.status).toBe(400)
        const respondents = await env.DB.prepare(
            "SELECT COUNT(*) AS n FROM survey_respondents WHERE survey_id = ?",
        )
            .bind(surveyId)
            .first<{ n: number }>()
        const answers = await env.DB.prepare(
            "SELECT COUNT(*) AS n FROM survey_answers WHERE survey_id = ?",
        )
            .bind(surveyId)
            .first<{ n: number }>()
        expect(respondents?.n).toBe(0)
        expect(answers?.n).toBe(0)
    })
})
