/**
 * 日次集計と残存回答の失敗が他のアンケートへ波及しないことを検証する。
 */
import { env } from "cloudflare:test"
import type { D1Database, SurveyResultsBucket } from "@/lib/platform/cfTypes"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { resetSurveyConfigCache } from "@/lib/survey/loadConfig"
import { runSurveyDaily } from "@/lib/survey/daily"
import { createValidSurveyConfig } from "../../fixtures/survey/config"
import { INDEX_KEY, resultKey } from "@/lib/survey/results/schema"

const NOW = new Date("2026-12-02T00:00:00Z")
const DID_HASH = "f".repeat(64)
const db = env.DB as unknown as D1Database
const bucket = env.SURVEY_RESULTS as unknown as SurveyResultsBucket
const deletableBucket = env.SURVEY_RESULTS as unknown as SurveyResultsBucket & {
    delete(key: string): Promise<void>
}
const IDS = [
    "survey-isolation-a",
    "survey-isolation-b",
    "orphan-x",
    "orphan-y",
    "orphan-z",
]

const configResponse = (config: unknown): Response =>
    new Response(JSON.stringify(config), {
        status: 200,
        headers: { "content-type": "application/json" },
    })

const assetsWith = (config: unknown) => ({
    fetch: vi.fn(async () => configResponse(config)),
})

const dailyEnv = (assets: {
    fetch(input: Request | string): Promise<Response>
}) => ({ DB: db, ASSETS: assets, SURVEY_RESULTS: bucket })

const twoClosedSurveys = () => {
    const template = createValidSurveyConfig().surveys[0]!
    return [
        {
            ...structuredClone(template),
            id: IDS[0]!,
            opensAt: "2026-10-01T00:00:00Z",
            closesAt: "2026-10-02T00:00:00Z",
        },
        {
            ...structuredClone(template),
            id: IDS[1]!,
            opensAt: "2026-11-01T00:00:00Z",
            closesAt: "2026-11-02T00:00:00Z",
        },
    ]
}

const insertRows = async (
    surveyId: string,
    answers = '{"q-purpose":"share"}',
) => {
    await db
        .prepare(
            "INSERT INTO survey_respondents (survey_id, did_hash) VALUES (?, ?)",
        )
        .bind(surveyId, DID_HASH)
        .run()
    await db
        .prepare(
            "INSERT INTO survey_answers (survey_id, id, answers, answered_on) VALUES (?, ?, ?, ?)",
        )
        .bind(surveyId, crypto.randomUUID(), answers, "2026-11-30")
        .run()
}

const countRows = async (
    table: "survey_answers" | "survey_respondents",
    surveyId: string,
): Promise<number> =>
    (
        await db
            .prepare(`SELECT COUNT(*) AS n FROM ${table} WHERE survey_id = ?`)
            .bind(surveyId)
            .first<{ n: number }>()
    )?.n ?? -1

const indexWith = (
    surveys: { id: string; closesAt: string; outcome: "result" | "empty" }[],
) => ({
    schemaVersion: 1,
    surveys: surveys.map(survey => ({
        ...survey,
        opensAt: "2026-01-01T00:00:00Z",
    })),
})

const resultBody = (id: string, closesAt: string) => ({
    schemaVersion: 1,
    id,
    opensAt: "2026-01-01T00:00:00Z",
    closesAt,
    questions: [],
})

describe("survey daily failure isolation", () => {
    beforeEach(async () => {
        vi.unstubAllEnvs()
        vi.restoreAllMocks()
        resetSurveyConfigCache()
        await db.prepare("DELETE FROM survey_answers").run()
        await db.prepare("DELETE FROM survey_respondents").run()
        await Promise.all([
            deletableBucket.delete(INDEX_KEY),
            ...IDS.map(id => deletableBucket.delete(resultKey(id))),
        ])
    })

    it("continues after one result save fails and records no private data", async () => {
        vi.stubEnv("PUBLIC_SURVEY_CONFIG_PRESENT", "true")
        const [surveyA, surveyB] = twoClosedSurveys()
        const configTextMarker = "private-config-marker"
        const resultTextMarker = "private-result-text-marker"
        surveyA!.description!.ja = configTextMarker
        surveyA!.questions[0]!.title.ja = resultTextMarker
        await insertRows(surveyA!.id, '{"q-purpose":"share"}')
        await insertRows(surveyB!.id, '{"q-purpose":"share"}')
        const originalPut = bucket.put.bind(bucket)
        vi.spyOn(bucket, "put").mockImplementation(
            async (key, value, options) => {
                if (key === resultKey(surveyA!.id))
                    throw new TypeError("private result failure")
                return await originalPut(key, value, options)
            },
        )
        const output = vi.spyOn(console, "error").mockImplementation(() => {})

        await expect(
            runSurveyDaily(
                dailyEnv(assetsWith({ surveys: [surveyA, surveyB] })),
                NOW,
            ),
        ).resolves.toBeUndefined()

        expect(await countRows("survey_answers", surveyA!.id)).toBe(1)
        expect(await countRows("survey_answers", surveyB!.id)).toBe(0)
        expect(await bucket.get(resultKey(surveyB!.id))).not.toBeNull()
        const indexObject = await bucket.get(INDEX_KEY)
        const index = JSON.parse(await indexObject!.text())
        expect(index.surveys).toContainEqual(
            expect.objectContaining({ id: surveyB!.id, outcome: "result" }),
        )
        expect(index.surveys).not.toContainEqual(
            expect.objectContaining({ id: surveyA!.id }),
        )
        const log = output.mock.calls.flat().join(" ")
        expect(log).toContain(surveyA!.id)
        expect(log).toContain("ResultInvalidError")
        for (const privateValue of [
            "q-purpose",
            "share",
            configTextMarker,
            resultTextMarker,
            "private result failure",
            DID_HASH,
        ])
            expect(log).not.toContain(privateValue)
    })

    it("keeps an invalid existing body while processing the other survey", async () => {
        vi.stubEnv("PUBLIC_SURVEY_CONFIG_PRESENT", "true")
        const [surveyA, surveyB] = twoClosedSurveys()
        const invalidBody = '{"private-body-marker": "not valid result JSON"'
        await bucket.put(resultKey(surveyA!.id), invalidBody)
        await insertRows(surveyA!.id)
        await insertRows(surveyB!.id)

        await runSurveyDaily(
            dailyEnv(assetsWith({ surveys: [surveyA, surveyB] })),
            NOW,
        )

        expect(await countRows("survey_answers", surveyA!.id)).toBe(1)
        expect(await countRows("survey_answers", surveyB!.id)).toBe(0)
        expect(await (await bucket.get(resultKey(surveyA!.id)))!.text()).toBe(
            invalidBody,
        )
        expect(await bucket.get(resultKey(surveyB!.id))).not.toBeNull()
    })

    it("isolates invalid residual bodies from valid and empty cleanup records", async () => {
        vi.stubEnv("PUBLIC_SURVEY_CONFIG_PRESENT", "false")
        const [x, y, z] = IDS.slice(2)
        const closesAt = "2026-12-01T00:00:00Z"
        await bucket.put(
            INDEX_KEY,
            JSON.stringify(
                indexWith([
                    { id: x!, closesAt, outcome: "result" },
                    { id: y!, closesAt, outcome: "result" },
                    { id: z!, closesAt, outcome: "empty" },
                ]),
            ),
        )
        await bucket.put(
            resultKey(x!),
            JSON.stringify(resultBody(x!, closesAt)),
        )
        const planted = "private-residual-body-marker"
        await bucket.put(resultKey(y!), `{"marker":"${planted}"`)
        await Promise.all([x!, y!, z!].map(id => insertRows(id)))
        const output = vi.spyOn(console, "error").mockImplementation(() => {})

        await runSurveyDaily(dailyEnv(assetsWith({ surveys: [] })), NOW)

        for (const id of [x!, z!]) {
            expect(await countRows("survey_answers", id)).toBe(0)
            expect(await countRows("survey_respondents", id)).toBe(0)
        }
        expect(await countRows("survey_answers", y!)).toBe(1)
        expect(await countRows("survey_respondents", y!)).toBe(1)
        const log = output.mock.calls.flat().join(" ")
        expect(log).toContain(y!)
        expect(log).toContain("ResultInvalidError")
        expect(log).not.toContain(planted)
    })

    it("logs the ids when the configured answers purge fails and still runs the cleanup", async () => {
        vi.stubEnv("PUBLIC_SURVEY_CONFIG_PRESENT", "true")
        const survey = twoClosedSurveys()[1]!
        const orphan = IDS[2]!
        const closesAt = "2026-12-01T00:00:00Z"
        await bucket.put(
            INDEX_KEY,
            JSON.stringify(
                indexWith([{ id: orphan, closesAt, outcome: "empty" }]),
            ),
        )
        await insertRows(survey.id, '{"q-purpose":"share"}')
        await insertRows(orphan)
        const originalBatch = db.batch.bind(db)
        let calls = 0
        vi.spyOn(db, "batch").mockImplementation(async statements => {
            calls += 1
            // 1: 集合の削除、2: 読み取り、3: 設定内の回答の削除（失敗させる）、4: 掃除
            if (calls === 3) throw new TypeError("private D1 failure")
            return await originalBatch(statements)
        })
        const output = vi.spyOn(console, "error").mockImplementation(() => {})

        await expect(
            runSurveyDaily(dailyEnv(assetsWith({ surveys: [survey] })), NOW),
        ).resolves.toBeUndefined()

        expect(await countRows("survey_answers", survey.id)).toBe(1)
        expect(await countRows("survey_answers", orphan)).toBe(0)
        const log = output.mock.calls.flat().join(" ")
        expect(log).toContain(`ids=${survey.id}`)
        expect(log).toContain("TypeError")
        expect(log).not.toContain("private D1 failure")
    })

    it("stops before writes for an invalid index but preserves the respondent purge", async () => {
        vi.stubEnv("PUBLIC_SURVEY_CONFIG_PRESENT", "true")
        const survey = twoClosedSurveys()[0]!
        const indexMarker = "private-invalid-index-marker"
        await insertRows(survey.id)
        await bucket.put(
            INDEX_KEY,
            JSON.stringify({ schemaVersion: 999, marker: indexMarker }),
        )
        const put = vi.spyOn(bucket, "put")
        const output = vi.spyOn(console, "error").mockImplementation(() => {})

        await runSurveyDaily(dailyEnv(assetsWith({ surveys: [survey] })), NOW)

        expect(put).not.toHaveBeenCalled()
        expect(await countRows("survey_answers", survey.id)).toBe(1)
        expect(await countRows("survey_respondents", survey.id)).toBe(0)
        const log = output.mock.calls.flat().join(" ")
        expect(log).toContain("IndexInvalidError")
        expect(log).not.toContain(indexMarker)
    })
})
