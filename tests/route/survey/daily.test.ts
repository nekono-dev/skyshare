/**
 * 日次処理の初期段階と回答済み集合の独立削除を検証する。
 */
import { env } from "cloudflare:test"
import type { D1Database, SurveyResultsBucket } from "@/lib/platform/cfTypes"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { resetSurveyConfigCache } from "@/lib/survey/loadConfig"
import { runSurveyDaily } from "@/lib/survey/daily"
import { createValidSurveyConfig } from "../../fixtures/survey/config"

const NOW = new Date("2026-12-02T00:00:00Z")
const SURVEY_ID = "survey-2026-a"
const DID_HASH = "f".repeat(64)
const db = env.DB as unknown as D1Database
const bucket = env.SURVEY_RESULTS as unknown as SurveyResultsBucket

const configResponse = (config: unknown): Response =>
    new Response(JSON.stringify(config), {
        status: 200,
        headers: { "content-type": "application/json" },
    })

const assetsWith = (response: () => Response | Promise<Response>) => ({
    fetch: vi.fn(async () => response()),
})

const dailyEnv = (
    assets: { fetch(input: Request | string): Promise<Response> },
    results: SurveyResultsBucket = bucket,
) => ({ DB: db, ASSETS: assets, SURVEY_RESULTS: results })

const insertRespondent = async (surveyId = SURVEY_ID): Promise<void> => {
    await db
        .prepare(
            "INSERT INTO survey_respondents (survey_id, did_hash) VALUES (?, ?)",
        )
        .bind(surveyId, DID_HASH)
        .run()
}

const respondentCount = async (surveyId = SURVEY_ID): Promise<number> =>
    (
        await db
            .prepare(
                "SELECT COUNT(*) AS n FROM survey_respondents WHERE survey_id = ?",
            )
            .bind(surveyId)
            .first<{ n: number }>()
    )?.n ?? -1

describe("survey daily entry", () => {
    beforeEach(async () => {
        vi.unstubAllEnvs()
        vi.restoreAllMocks()
        resetSurveyConfigCache()
        await db
            .prepare("DELETE FROM survey_respondents WHERE survey_id = ?")
            .bind(SURVEY_ID)
            .run()
        await db
            .prepare("DELETE FROM survey_answers WHERE survey_id = ?")
            .bind(SURVEY_ID)
            .run()
    })

    it("returns without touching bindings or fetching config when disabled", async () => {
        vi.stubEnv("PUBLIC_SURVEY_CONFIG_PRESENT", "true")
        const assets = assetsWith(() =>
            configResponse(createValidSurveyConfig()),
        )
        const prepare = vi.spyOn(db, "prepare")
        const batch = vi.spyOn(db, "batch")
        const get = vi.spyOn(bucket, "get")

        await runSurveyDaily(
            { DB: db, ASSETS: assets, SURVEY_RESULTS: undefined },
            NOW,
        )

        expect(prepare).not.toHaveBeenCalled()
        expect(batch).not.toHaveBeenCalled()
        expect(get).not.toHaveBeenCalled()
        expect(assets.fetch).not.toHaveBeenCalled()
    })

    it("leaves data unchanged when no survey has closed", async () => {
        vi.stubEnv("PUBLIC_SURVEY_CONFIG_PRESENT", "true")
        const config = createValidSurveyConfig()
        config.surveys[0]!.closesAt = "2027-01-01T00:00:00+09:00"
        const assets = assetsWith(() => configResponse(config))
        const batch = vi.spyOn(db, "batch")

        await runSurveyDaily(dailyEnv(assets), NOW)

        expect(await respondentCount()).toBe(0)
        expect(batch).not.toHaveBeenCalled()
    })

    it("purges all closed respondent sets in one batch before the first R2 read", async () => {
        vi.stubEnv("PUBLIC_SURVEY_CONFIG_PRESENT", "true")
        await insertRespondent()
        const assets = assetsWith(() =>
            configResponse(createValidSurveyConfig()),
        )
        const order: string[] = []
        const originalBatch = db.batch.bind(db)
        const batch = vi
            .spyOn(db, "batch")
            .mockImplementation(async statements => {
                order.push("d1-batch")
                return await originalBatch(statements)
            })
        const get = vi.spyOn(bucket, "get").mockImplementation(async key => {
            order.push(`r2-get:${key}`)
            return null
        })

        await runSurveyDaily(dailyEnv(assets), NOW)

        expect(await respondentCount()).toBe(0)
        expect(batch).toHaveBeenCalledTimes(1)
        expect(order[0]).toBe("d1-batch")
        expect(order[1]).toBe("r2-get:index.json")
        get.mockRestore()
        batch.mockRestore()
    })

    it("continues to the index read when config is absent", async () => {
        vi.stubEnv("PUBLIC_SURVEY_CONFIG_PRESENT", "false")
        const assets = assetsWith(() =>
            configResponse(createValidSurveyConfig()),
        )
        const get = vi.spyOn(bucket, "get").mockResolvedValue(null)

        await runSurveyDaily(dailyEnv(assets), NOW)

        expect(assets.fetch).not.toHaveBeenCalled()
        expect(get).toHaveBeenCalledWith("index.json")
        get.mockRestore()
    })

    it("logs only the error class and deletes nothing when present config is unreadable", async () => {
        vi.stubEnv("PUBLIC_SURVEY_CONFIG_PRESENT", "true")
        await insertRespondent()
        const marker = "planted-secret-config-body"
        const assets = assetsWith(
            () => new Response(`{ "secret": "${marker}"`, { status: 200 }),
        )
        const batch = vi.spyOn(db, "batch")
        const output = vi.spyOn(console, "error").mockImplementation(() => {})
        const get = vi.spyOn(bucket, "get")

        await runSurveyDaily(dailyEnv(assets), NOW)

        expect(await respondentCount()).toBe(1)
        expect(batch).not.toHaveBeenCalled()
        expect(get).not.toHaveBeenCalled()
        const log = output.mock.calls.flat().join(" ")
        expect(log).toContain("error=Error")
        expect(log).not.toContain(marker)
    })

    it("keeps the respondent purge when the index read fails", async () => {
        vi.stubEnv("PUBLIC_SURVEY_CONFIG_PRESENT", "true")
        await insertRespondent()
        const assets = assetsWith(() =>
            configResponse(createValidSurveyConfig()),
        )
        const output = vi.spyOn(console, "error").mockImplementation(() => {})
        const batch = vi.spyOn(db, "batch")
        const get = vi
            .spyOn(bucket, "get")
            .mockRejectedValue(new Error("private failure"))

        await runSurveyDaily(dailyEnv(assets), NOW)

        expect(await respondentCount()).toBe(0)
        expect(batch).toHaveBeenCalledTimes(1)
        expect(output.mock.calls.flat().join(" ")).toContain(
            "IndexInvalidError",
        )
        get.mockRestore()
    })

    it("continues to the index read and records only the class when purge fails", async () => {
        vi.stubEnv("PUBLIC_SURVEY_CONFIG_PRESENT", "true")
        const assets = assetsWith(() =>
            configResponse(createValidSurveyConfig()),
        )
        const output = vi.spyOn(console, "error").mockImplementation(() => {})
        const batch = vi
            .spyOn(db, "batch")
            .mockRejectedValue(new TypeError("private D1 failure"))
        const get = vi.spyOn(bucket, "get").mockResolvedValue(null)

        await runSurveyDaily(dailyEnv(assets), NOW)

        expect(batch).toHaveBeenCalledTimes(1)
        expect(get).toHaveBeenCalledWith("index.json")
        const log = output.mock.calls.flat().join(" ")
        expect(log).toContain(`ids=${SURVEY_ID}`)
        expect(log).toContain("error=TypeError")
        expect(log).not.toContain("private D1 failure")
        get.mockRestore()
    })
})
