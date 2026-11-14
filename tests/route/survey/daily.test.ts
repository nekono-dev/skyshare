/**
 * 日次処理の初期段階と回答済み集合の独立削除を検証する。
 */
import { env } from "cloudflare:test"
import type { D1Database, SurveyResultsBucket } from "@/lib/platform/cfTypes"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { resetSurveyConfigCache } from "@/lib/survey/loadConfig"
import { runSurveyDaily } from "@/lib/survey/daily"
import { createValidSurveyConfig } from "../../fixtures/survey/config"
import {
    INDEX_KEY,
    resultKey,
    visibilityKey,
} from "@/lib/survey/results/schema"

const NOW = new Date("2026-12-02T00:00:00Z")
const SURVEY_ID = "survey-2026-a"
const DID_HASH = "f".repeat(64)
const db = env.DB as unknown as D1Database
const bucket = env.SURVEY_RESULTS as unknown as SurveyResultsBucket
const deletableBucket = env.SURVEY_RESULTS as unknown as SurveyResultsBucket & {
    delete(key: string): Promise<void>
}

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

const answerCount = async (surveyId = SURVEY_ID): Promise<number> =>
    (
        await db
            .prepare(
                "SELECT COUNT(*) AS n FROM survey_answers WHERE survey_id = ?",
            )
            .bind(surveyId)
            .first<{ n: number }>()
    )?.n ?? -1

const insertAnswer = async (answers: string, surveyId = SURVEY_ID) => {
    await db
        .prepare(
            "INSERT INTO survey_answers (survey_id, id, answers, answered_on) VALUES (?, ?, ?, ?)",
        )
        .bind(surveyId, crypto.randomUUID(), answers, "2026-11-30")
        .run()
}

const resetResultObjects = async (): Promise<void> => {
    await Promise.all([
        deletableBucket.delete(INDEX_KEY),
        deletableBucket.delete(resultKey(SURVEY_ID)),
        deletableBucket.delete(visibilityKey(SURVEY_ID)),
    ])
}

const readJson = async (key: string): Promise<unknown> => {
    const object = await bucket.get(key)
    return object === null ? undefined : JSON.parse(await object.text())
}

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
        await resetResultObjects()
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
        expect(batch.mock.calls[0]?.[0]).toHaveLength(1)
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

        expect(batch.mock.calls[0]?.[0]).toHaveLength(1)
        expect(get).toHaveBeenCalledWith("index.json")
        const log = output.mock.calls.flat().join(" ")
        expect(log).toContain(`ids=${SURVEY_ID}`)
        expect(log).toContain("error=TypeError")
        expect(log).not.toContain("private D1 failure")
        get.mockRestore()
    })

    it("saves a result, confirms the index, then deletes answers without overwriting on rerun", async () => {
        vi.stubEnv("PUBLIC_SURVEY_CONFIG_PRESENT", "true")
        const assets = assetsWith(() =>
            configResponse(createValidSurveyConfig()),
        )
        await insertAnswer('{"q-purpose":"share"}')
        await insertAnswer('{"q-purpose":"save"}')
        const put = vi.spyOn(bucket, "put")

        await runSurveyDaily(dailyEnv(assets), NOW)

        expect(await answerCount()).toBe(0)
        const saved = await bucket.get(resultKey(SURVEY_ID))
        expect(saved).not.toBeNull()
        const storedBody = await saved!.text()
        expect(JSON.parse(storedBody)).toMatchObject({ id: SURVEY_ID })
        expect(await readJson(INDEX_KEY)).toMatchObject({
            surveys: [{ id: SURVEY_ID, outcome: "result" }],
        })
        expect(
            put.mock.calls.some(([key]) => key === visibilityKey(SURVEY_ID)),
        ).toBe(false)
        put.mockClear()

        await insertAnswer('{"q-purpose":"share"}')
        await runSurveyDaily(dailyEnv(assets), NOW)

        expect(await answerCount()).toBe(0)
        expect(await (await bucket.get(resultKey(SURVEY_ID)))!.text()).toBe(
            storedBody,
        )
        expect(
            put.mock.calls.some(([key]) => key === resultKey(SURVEY_ID)),
        ).toBe(false)
        put.mockRestore()
    })

    it("keeps answers when the index write reports success but the record is not stored", async () => {
        vi.stubEnv("PUBLIC_SURVEY_CONFIG_PRESENT", "true")
        await insertAnswer('{"q-purpose":"share"}')
        const originalPut = bucket.put.bind(bucket)
        const put = vi
            .spyOn(bucket, "put")
            .mockImplementation(async (key, value, options) => {
                // 目録だけ、成功を返すが保存しない（書き込みが失われた状態）
                if (key === INDEX_KEY) return { etag: "lost" }
                return await originalPut(key, value, options)
            })
        vi.spyOn(console, "error").mockImplementation(() => {})

        await runSurveyDaily(
            dailyEnv(
                assetsWith(() => configResponse(createValidSurveyConfig())),
            ),
            NOW,
        )

        expect(await answerCount()).toBe(1)
        expect(await readJson(INDEX_KEY)).toBeUndefined()
        put.mockRestore()
    })

    it("records empty before deleting when no answer is valid", async () => {
        vi.stubEnv("PUBLIC_SURVEY_CONFIG_PRESENT", "true")
        await insertAnswer('{"q-purpose":"unknown"}')

        await runSurveyDaily(
            dailyEnv(
                assetsWith(() => configResponse(createValidSurveyConfig())),
            ),
            NOW,
        )

        expect(await answerCount()).toBe(0)
        expect(await readJson(INDEX_KEY)).toMatchObject({
            surveys: [{ id: SURVEY_ID, outcome: "empty" }],
        })
        expect(await bucket.get(resultKey(SURVEY_ID))).toBeNull()
    })

    it("verifies a body-only result and supplements the index before deleting", async () => {
        vi.stubEnv("PUBLIC_SURVEY_CONFIG_PRESENT", "true")
        const config = createValidSurveyConfig()
        const survey = config.surveys[0]!
        const result = {
            schemaVersion: 1,
            id: survey.id,
            opensAt: survey.opensAt,
            closesAt: survey.closesAt,
            questions: [],
        }
        await bucket.put(resultKey(SURVEY_ID), JSON.stringify(result))
        await insertAnswer('{"q-purpose":"share"}')

        await runSurveyDaily(
            dailyEnv(assetsWith(() => configResponse(config))),
            NOW,
        )

        expect(await answerCount()).toBe(0)
        expect(await readJson(INDEX_KEY)).toMatchObject({
            surveys: [{ id: SURVEY_ID, outcome: "result" }],
        })
    })

    it("rereads a different existing body after a create-only write reports exists", async () => {
        vi.stubEnv("PUBLIC_SURVEY_CONFIG_PRESENT", "true")
        const config = createValidSurveyConfig()
        const survey = config.surveys[0]!
        const existing = {
            schemaVersion: 1,
            id: survey.id,
            opensAt: survey.opensAt,
            closesAt: survey.closesAt,
            questions: [],
        }
        await insertAnswer('{"q-purpose":"share"}')
        const originalPut = bucket.put.bind(bucket)
        const originalGet = bucket.get.bind(bucket)
        let resultReads = 0
        const get = vi.spyOn(bucket, "get").mockImplementation(async key => {
            if (key === resultKey(SURVEY_ID) && resultReads++ === 0) return null
            return await originalGet(key)
        })
        const put = vi
            .spyOn(bucket, "put")
            .mockImplementation(async (key, value, options) => {
                if (key !== resultKey(SURVEY_ID))
                    return await originalPut(key, value, options)
                // 他の書き込み者が先に作った状態を再現し、上書き禁止の作成を失敗させる
                await originalPut(key, JSON.stringify(existing))
                return null
            })

        await runSurveyDaily(
            dailyEnv(assetsWith(() => configResponse(config))),
            NOW,
        )

        expect(await answerCount()).toBe(0)
        expect(
            get.mock.calls.filter(([key]) => key === resultKey(SURVEY_ID)),
        ).toHaveLength(3)
        expect(await readJson(resultKey(SURVEY_ID))).toEqual(existing)
        put.mockRestore()
        get.mockRestore()
    })

    it("keeps answers when an existing result body is invalid or mismatched", async () => {
        vi.stubEnv("PUBLIC_SURVEY_CONFIG_PRESENT", "true")
        await bucket.put(resultKey(SURVEY_ID), '{"privateBodyMarker":"x"')
        await insertAnswer('{"q-purpose":"answer-secret-marker"}')
        const output = vi.spyOn(console, "error").mockImplementation(() => {})

        await runSurveyDaily(
            dailyEnv(
                assetsWith(() => configResponse(createValidSurveyConfig())),
            ),
            NOW,
        )

        expect(await answerCount()).toBe(1)
        expect(output.mock.calls.flat().join(" ")).not.toContain(
            "privateBodyMarker",
        )
        expect(output.mock.calls.flat().join(" ")).not.toContain(
            "answer-secret-marker",
        )
        output.mockRestore()
    })

    it("keeps answers when an existing result has a different period", async () => {
        vi.stubEnv("PUBLIC_SURVEY_CONFIG_PRESENT", "true")
        const config = createValidSurveyConfig()
        const survey = config.surveys[0]!
        await bucket.put(
            resultKey(SURVEY_ID),
            JSON.stringify({
                schemaVersion: 1,
                id: survey.id,
                opensAt: survey.opensAt,
                closesAt: "2027-01-01T00:00:00Z",
                questions: [],
            }),
        )
        await insertAnswer('{"q-purpose":"share"}')

        await runSurveyDaily(
            dailyEnv(assetsWith(() => configResponse(config))),
            NOW,
        )

        expect(await answerCount()).toBe(1)
        expect(await bucket.get(INDEX_KEY)).toBeNull()
    })

    it("recovers a missing body with the index period when it differs from the config period", async () => {
        vi.stubEnv("PUBLIC_SURVEY_CONFIG_PRESENT", "true")
        const config = createValidSurveyConfig()
        const survey = config.surveys[0]!
        const indexedClosesAt = "2026-11-30T00:00:00+09:00"
        await bucket.put(
            INDEX_KEY,
            JSON.stringify({
                schemaVersion: 1,
                surveys: [
                    {
                        id: survey.id,
                        opensAt: survey.opensAt,
                        closesAt: indexedClosesAt,
                        outcome: "result",
                    },
                ],
            }),
        )
        await insertAnswer('{"q-purpose":"share"}')
        const assets = assetsWith(() => configResponse(config))

        await runSurveyDaily(dailyEnv(assets), NOW)

        expect(await answerCount()).toBe(0)
        expect(await readJson(resultKey(SURVEY_ID))).toMatchObject({
            id: survey.id,
            opensAt: survey.opensAt,
            closesAt: indexedClosesAt,
        })
        const savedBody = await (await bucket.get(resultKey(SURVEY_ID)))!.text()

        await insertAnswer('{"q-purpose":"save"}')
        await runSurveyDaily(dailyEnv(assets), NOW)

        expect(await answerCount()).toBe(0)
        expect(await (await bucket.get(resultKey(SURVEY_ID)))!.text()).toBe(
            savedBody,
        )
    })

    it("keeps answers when recovery save fails for an indexed result without a body", async () => {
        vi.stubEnv("PUBLIC_SURVEY_CONFIG_PRESENT", "true")
        const config = createValidSurveyConfig()
        const survey = config.surveys[0]!
        await bucket.put(
            INDEX_KEY,
            JSON.stringify({
                schemaVersion: 1,
                surveys: [
                    {
                        id: survey.id,
                        opensAt: survey.opensAt,
                        closesAt: survey.closesAt,
                        outcome: "result",
                    },
                ],
            }),
        )
        await insertAnswer('{"q-purpose":"share"}')
        const originalPut = bucket.put.bind(bucket)
        const put = vi
            .spyOn(bucket, "put")
            .mockImplementation(async (key, value, options) => {
                if (key === resultKey(SURVEY_ID))
                    throw new TypeError("private R2 failure")
                return await originalPut(key, value, options)
            })

        await runSurveyDaily(
            dailyEnv(assetsWith(() => configResponse(config))),
            NOW,
        )

        expect(await answerCount()).toBe(1)
        expect(
            put.mock.calls.some(([key]) => key === resultKey(SURVEY_ID)),
        ).toBe(true)
        put.mockRestore()
    })

    it("aborts answer aggregation and deletion when the index is invalid", async () => {
        vi.stubEnv("PUBLIC_SURVEY_CONFIG_PRESENT", "true")
        await insertAnswer('{"q-purpose":"share"}')
        await bucket.put(INDEX_KEY, '{"privateIndexMarker":"x"')
        const output = vi.spyOn(console, "error").mockImplementation(() => {})
        const batch = vi.spyOn(db, "batch")

        await runSurveyDaily(
            dailyEnv(
                assetsWith(() => configResponse(createValidSurveyConfig())),
            ),
            NOW,
        )

        expect(await answerCount()).toBe(1)
        expect(batch).toHaveBeenCalledTimes(1)
        expect(output.mock.calls.flat().join(" ")).not.toContain(
            "privateIndexMarker",
        )
        output.mockRestore()
    })
})
