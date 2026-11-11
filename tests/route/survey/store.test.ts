/**
 * Verifies anonymous survey persistence and cleanup.
 */
import { env } from "cloudflare:test"
import type { D1Database } from "@/lib/platform/cfTypes"
import { describe, expect, it } from "vitest"
import {
    isRespondent,
    purgeAnswers,
    purgeRespondents,
    registerRespondent,
    saveAnswer,
} from "@/lib/survey/store"
import { TEST_DID } from "../../fixtures/identities"

const DID_HASH = "a".repeat(64)
const OTHER_HASH = "b".repeat(64)

describe("survey store (anonymity)", () => {
    it("saves an answer once per respondent and reports a duplicate for the second attempt", async () => {
        const input = {
            surveyId: "survey-2026-a",
            didHash: DID_HASH,
            answerId: "ans-1",
            answersJson: "{}",
            answeredOn: "2026-11-02",
        }
        expect(await saveAnswer(env.DB, input)).toBe("saved")
        expect(await saveAnswer(env.DB, { ...input, answerId: "ans-2" })).toBe(
            "duplicate",
        )
        const count = await env.DB.prepare(
            "SELECT COUNT(*) AS n FROM survey_answers",
        ).first<{ n: number }>()
        expect(count?.n).toBe(1)
    })

    it("never stores the DID itself, only its hash, in any survey table", async () => {
        await saveAnswer(env.DB, {
            surveyId: "survey-2026-a",
            didHash: DID_HASH,
            answerId: "ans-1",
            answersJson: '{"q-purpose":"share"}',
            answeredOn: "2026-11-02",
        })
        const respondents = await env.DB.prepare(
            "SELECT * FROM survey_respondents",
        ).all()
        const answers = await env.DB.prepare(
            "SELECT * FROM survey_answers",
        ).all()
        const stored = JSON.stringify([respondents.results, answers.results])
        expect(stored).not.toContain(TEST_DID)
        expect(Object.keys(respondents.results[0] ?? {}).sort()).toEqual([
            "did_hash",
            "survey_id",
        ])
    })

    it("answers the membership question for a registered respondent only", async () => {
        expect(await isRespondent(env.DB, "survey-2026-a", OTHER_HASH)).toBe(
            false,
        )
        await registerRespondent(env.DB, "survey-2026-a", OTHER_HASH)
        expect(await isRespondent(env.DB, "survey-2026-a", OTHER_HASH)).toBe(
            true,
        )
    })

    it("purges only the rows of the given survey, leaving other surveys intact", async () => {
        await registerRespondent(env.DB, "survey-2026-a", DID_HASH)
        await registerRespondent(env.DB, "survey-2026-b", DID_HASH)
        expect(
            await purgeRespondents(env.DB, "survey-2026-a"),
        ).toBeGreaterThanOrEqual(1)
        expect(await isRespondent(env.DB, "survey-2026-a", DID_HASH)).toBe(
            false,
        )
        expect(await isRespondent(env.DB, "survey-2026-b", DID_HASH)).toBe(true)
    })

    it("purges the answers of the given survey", async () => {
        await saveAnswer(env.DB, {
            surveyId: "survey-2026-c",
            didHash: OTHER_HASH,
            answerId: "ans-9",
            answersJson: "{}",
            answeredOn: "2026-11-02",
        })
        expect(await purgeAnswers(env.DB, "survey-2026-c")).toBe(1)
    })
})

describe("survey store (failure classes)", () => {
    it("rethrows a failure that is not a duplicate respondent (an answer id already used)", async () => {
        await saveAnswer(env.DB, {
            surveyId: "survey-2026-d",
            didHash: "d".repeat(64),
            answerId: "ans-x",
            answersJson: "{}",
            answeredOn: "2026-11-02",
        })
        await expect(
            saveAnswer(env.DB, {
                surveyId: "survey-2026-d",
                didHash: "e".repeat(64),
                answerId: "ans-x",
                answersJson: "{}",
                answeredOn: "2026-11-02",
            }),
        ).rejects.toThrow()
    })

    it("reports zero removed rows when the survey has no respondents", async () => {
        expect(await purgeRespondents(env.DB, "survey-none")).toBe(0)
    })
})

describe("survey store (missing change count)", () => {
    it("reports zero removed rows when the database result carries no change count", async () => {
        const db = {
            prepare: () => ({
                bind: () => ({ run: async () => ({}) }),
            }),
        } as unknown as D1Database
        expect(await purgeRespondents(db, "survey-2026-a")).toBe(0)
        expect(await purgeAnswers(db, "survey-2026-a")).toBe(0)
    })
})
