/**
 * Verifies survey request authentication and eligibility.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const state = vi.hoisted(() => ({
    hashKey: "fixture-hash-key" as string | undefined,
    resultsBucket: true,
    readSurveyConfig: vi.fn(),
    db: { prepare: vi.fn(), batch: vi.fn() },
}))
vi.mock("@/lib/survey/env", () => ({
    getSurveyEnv: async () => ({
        DB: state.db,
        SURVEY_RESULTS: state.resultsBucket ? {} : undefined,
        ASSETS: { fetch: vi.fn() },
        SURVEY_HASH_KEY: state.hashKey,
    }),
}))
vi.mock("@/lib/survey/loadConfig", () => ({
    readSurveyConfig: state.readSurveyConfig,
}))

import { resolveSurveyRequest } from "@/lib/survey/request"
import { POST } from "@/pages/v2/surveys/[surveyId]/answers"
import {
    GET as answeredCheck,
    PUT as respondentPresentation,
} from "@/pages/v2/surveys/[surveyId]/respondent"
import { createValidSurveyConfig } from "../../fixtures/survey/config"
import { TEST_DID } from "../../fixtures/identities"

const DURING = new Date("2026-11-15T00:00:00+09:00")
const request = (surveyId = "survey-2026-a") =>
    new Request(`https://skyshare.test/v2/surveys/${surveyId}/answers`)

describe("resolveSurveyRequest (entry gate)", () => {
    beforeEach(() => {
        // 設定は配信用に存在する（ビルド時の値を、テストで与える）
        vi.stubEnv("PUBLIC_SURVEY_CONFIG_PRESENT", "true")
        state.hashKey = "fixture-hash-key"
        state.resultsBucket = true
        state.db.prepare.mockClear()
        state.db.batch.mockClear()
        state.readSurveyConfig.mockReset()
        state.readSurveyConfig.mockResolvedValue(createValidSurveyConfig())
    })

    afterEach(() => {
        vi.unstubAllEnvs()
    })

    it("returns 401 when there is no session", async () => {
        const result = await resolveSurveyRequest({
            request: request(),
            params: { surveyId: "survey-2026-a" },
            locals: {},
            now: DURING,
        })
        expect(result.ok).toBe(false)
        if (!result.ok) expect(result.response.status).toBe(401)
    })

    it("returns 400 for a survey id that is not a valid identifier", async () => {
        const result = await resolveSurveyRequest({
            request: request("Bad ID!"),
            params: { surveyId: "Bad ID!" },
            locals: { session: { did: TEST_DID } },
            now: DURING,
        })
        if (result.ok) throw new Error("expected a failure")
        expect(result.response.status).toBe(400)
    })

    it("returns 404 when the survey is not the one open at the time (outside its period)", async () => {
        const result = await resolveSurveyRequest({
            request: request(),
            params: { surveyId: "survey-2026-a" },
            locals: { session: { did: TEST_DID } },
            now: new Date("2026-10-01T00:00:00+09:00"),
        })
        if (result.ok) throw new Error("expected a failure")
        expect(result.response.status).toBe(404)
    })

    it("returns 503 when the hash key is not configured, so no respondent can be identified", async () => {
        state.hashKey = undefined
        const result = await resolveSurveyRequest({
            request: request(),
            params: { surveyId: "survey-2026-a" },
            locals: { session: { did: TEST_DID } },
            now: DURING,
        })
        if (result.ok) throw new Error("expected a failure")
        expect(result.response.status).toBe(503)
    })

    it("passes the DID and the key to the handler when the survey is open", async () => {
        const result = await resolveSurveyRequest({
            request: request(),
            params: { surveyId: "survey-2026-a" },
            locals: { session: { did: TEST_DID } },
            now: DURING,
        })
        if (!result.ok) throw new Error("expected success")
        expect(result.context.did).toBe(TEST_DID)
        expect(result.context.hashKey).toBe("fixture-hash-key")
        expect(result.context.survey.id).toBe("survey-2026-a")
    })

    it.each([
        ["提示", respondentPresentation, "PUT"],
        ["回答", POST, "POST"],
        ["回答済み確認", answeredCheck, "GET"],
    ])(
        "%s returns the no-config 404 before loading config when disabled",
        async (_name, handler, method) => {
            state.readSurveyConfig.mockResolvedValue(undefined)
            const noConfig = await resolveSurveyRequest({
                request: request(),
                params: { surveyId: "survey-2026-a" },
                locals: { session: { did: TEST_DID } },
                now: DURING,
            })
            if (noConfig.ok) throw new Error("expected a failure")

            state.resultsBucket = false
            state.readSurveyConfig.mockClear()
            const response = await handler({
                request: new Request(request().url, { method }),
                params: { surveyId: "survey-2026-a" },
                locals: { session: { did: TEST_DID } },
            } as unknown as Parameters<typeof handler>[0])

            expect(response.status).toBe(noConfig.response.status)
            expect(await response.text()).toBe(await noConfig.response.text())
            expect(state.readSurveyConfig).not.toHaveBeenCalled()
            expect(state.db.prepare).not.toHaveBeenCalled()
            expect(state.db.batch).not.toHaveBeenCalled()
        },
    )
})
