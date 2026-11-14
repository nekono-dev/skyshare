/**
 * 設定から外れた終了済みアンケートの残存回答の掃除を検証する。
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
const DID_HASH = "f".repeat(64)
const db = env.DB as unknown as D1Database
const bucket = env.SURVEY_RESULTS as unknown as SurveyResultsBucket
const deletableBucket = env.SURVEY_RESULTS as unknown as SurveyResultsBucket & {
    delete(key: string): Promise<void>
}

const assetsWith = (config: unknown) => ({
    fetch: vi.fn(
        async () =>
            new Response(JSON.stringify(config), {
                status: 200,
                headers: { "content-type": "application/json" },
            }),
    ),
})

const dailyEnv = (assets: {
    fetch(input: Request | string): Promise<Response>
}) => ({ DB: db, ASSETS: assets, SURVEY_RESULTS: bucket })

const emptyConfig = () => ({ surveys: [] })

const indexWith = (
    surveys: { id: string; closesAt: string; outcome: "result" | "empty" }[],
) => ({
    schemaVersion: 1,
    surveys: surveys.map(survey => ({
        ...survey,
        opensAt: "2026-01-01T00:00:00Z",
    })),
})

const setIndex = async (surveys: Parameters<typeof indexWith>[0]) =>
    bucket.put(INDEX_KEY, JSON.stringify(indexWith(surveys)))

const insertRows = async (surveyId: string): Promise<void> => {
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
        .bind(
            surveyId,
            crypto.randomUUID(),
            '{"q-purpose":"share"}',
            "2026-11-30",
        )
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

const resultBody = (id: string, closesAt: string) => ({
    schemaVersion: 1,
    id,
    opensAt: "2026-01-01T00:00:00Z",
    closesAt,
    questions: [],
})

describe("survey daily residual answer cleanup", () => {
    beforeEach(async () => {
        vi.unstubAllEnvs()
        vi.restoreAllMocks()
        resetSurveyConfigCache()
        await db.prepare("DELETE FROM survey_answers").run()
        await db.prepare("DELETE FROM survey_respondents").run()
        await deletableBucket.delete(INDEX_KEY)
    })

    it("reads configured answers and residual ids in one batch and purges only present rows", async () => {
        vi.stubEnv("PUBLIC_SURVEY_CONFIG_PRESENT", "true")
        const configured = createValidSurveyConfig().surveys[0]!
        const closedAt = "2026-12-01T00:00:00Z"
        const assets = assetsWith({ surveys: [configured] })
        await setIndex([
            { id: "orphan-present", closesAt: closedAt, outcome: "empty" },
            { id: "orphan-absent", closesAt: closedAt, outcome: "empty" },
        ])
        await insertRows("orphan-present")
        const batch = vi.spyOn(db, "batch")
        const prepare = vi.spyOn(db, "prepare")

        await runSurveyDaily(dailyEnv(assets), NOW)

        expect(batch).toHaveBeenCalledTimes(4)
        expect(
            prepare.mock.calls.filter(([sql]) =>
                sql.includes("SELECT survey_id FROM survey_answers"),
            ),
        ).toHaveLength(1)
        // 集合の削除 1 文 → 回答と残存の読み取り 2 文（同じ batch）→ 設定内の削除 2 文 → 掃除の削除 2 文
        expect(
            batch.mock.calls.map(([statements]) => statements.length),
        ).toEqual([1, 2, 2, 2])
        expect(await countRows("survey_answers", "orphan-present")).toBe(0)
        expect(await countRows("survey_respondents", "orphan-present")).toBe(0)
        expect(await countRows("survey_answers", "orphan-absent")).toBe(0)
        batch.mockRestore()
        prepare.mockRestore()
    })

    it("verifies result bodies before deleting and trusts empty index entries", async () => {
        vi.stubEnv("PUBLIC_SURVEY_CONFIG_PRESENT", "false")
        const validId = "orphan-result"
        const emptyId = "orphan-empty"
        const missingId = "orphan-missing"
        const invalidId = "orphan-invalid"
        const mismatchId = "orphan-mismatch"
        const closesAt = "2026-12-01T00:00:00Z"
        await setIndex([
            { id: validId, closesAt, outcome: "result" },
            { id: emptyId, closesAt, outcome: "empty" },
            { id: missingId, closesAt, outcome: "result" },
            { id: invalidId, closesAt, outcome: "result" },
            { id: mismatchId, closesAt, outcome: "result" },
        ])
        await Promise.all(
            [validId, emptyId, missingId, invalidId, mismatchId].map(
                insertRows,
            ),
        )
        await bucket.put(
            resultKey(validId),
            JSON.stringify(resultBody(validId, closesAt)),
        )
        await bucket.put(resultKey(invalidId), '{"privateBodyMarker":"secret"')
        await bucket.put(
            resultKey(mismatchId),
            JSON.stringify(resultBody(mismatchId, "2026-11-01T00:00:00Z")),
        )
        const get = vi.spyOn(bucket, "get")
        const output = vi.spyOn(console, "error").mockImplementation(() => {})

        await runSurveyDaily(dailyEnv(assetsWith(emptyConfig())), NOW)

        for (const id of [validId, emptyId]) {
            expect(await countRows("survey_answers", id)).toBe(0)
            expect(await countRows("survey_respondents", id)).toBe(0)
        }
        for (const id of [missingId, invalidId, mismatchId]) {
            expect(await countRows("survey_answers", id)).toBe(1)
            expect(await countRows("survey_respondents", id)).toBe(1)
        }
        expect(get).not.toHaveBeenCalledWith(resultKey(emptyId))
        expect(output.mock.calls.flat().join(" ")).not.toContain(
            "privateBodyMarker",
        )
        expect(output.mock.calls.flat().join(" ")).not.toContain("secret")
        get.mockRestore()
        output.mockRestore()
    })

    it("keeps configured surveys in the main flow and does not clean blocked recovery ids", async () => {
        vi.stubEnv("PUBLIC_SURVEY_CONFIG_PRESENT", "true")
        const config = createValidSurveyConfig()
        const survey = config.surveys[0]!
        const closesAt = survey.closesAt
        await setIndex([{ id: survey.id, closesAt, outcome: "result" }])
        await insertRows(survey.id)
        const put = vi.spyOn(bucket, "put").mockImplementation(async () => {
            throw new TypeError("private storage failure")
        })

        await runSurveyDaily(dailyEnv(assetsWith(config)), NOW)

        expect(await countRows("survey_answers", survey.id)).toBe(1)
        expect(await countRows("survey_respondents", survey.id)).toBe(0)
        put.mockRestore()
    })

    it("removes only the newest 200 candidates", async () => {
        vi.stubEnv("PUBLIC_SURVEY_CONFIG_PRESENT", "false")
        const candidates = Array.from({ length: 201 }, (_, index) => ({
            id: `orphan-${String(index).padStart(3, "0")}`,
            closesAt: new Date(Date.UTC(2026, 0, index + 1)).toISOString(),
            outcome: "empty" as const,
        }))
        await setIndex(candidates)
        await Promise.all(candidates.map(({ id }) => insertRows(id)))
        const batch = vi.spyOn(db, "batch")

        await runSurveyDaily(dailyEnv(assetsWith(emptyConfig())), NOW)

        expect(await countRows("survey_answers", "orphan-000")).toBe(1)
        expect(await countRows("survey_respondents", "orphan-000")).toBe(1)
        expect(await countRows("survey_answers", "orphan-001")).toBe(0)
        expect(await countRows("survey_answers", "orphan-200")).toBe(0)
        expect(batch.mock.calls.length).toBeLessThanOrEqual(13)
        batch.mockRestore()
    })

    it("continues to later deletion groups after a group fails and logs only ids and class", async () => {
        vi.stubEnv("PUBLIC_SURVEY_CONFIG_PRESENT", "false")
        const candidates = Array.from({ length: 25 }, (_, index) => ({
            id: `group-${String(index).padStart(2, "0")}`,
            closesAt: "2026-12-01T00:00:00Z",
            outcome: "empty" as const,
        }))
        await setIndex(candidates)
        await Promise.all(candidates.map(({ id }) => insertRows(id)))
        const originalBatch = db.batch.bind(db)
        let deleteBatch = 0
        const batch = vi
            .spyOn(db, "batch")
            .mockImplementation(async statements => {
                if (statements.length > 1) {
                    deleteBatch += 1
                    if (deleteBatch === 1)
                        throw new TypeError("private D1 failure")
                }
                return await originalBatch(statements)
            })
        const output = vi.spyOn(console, "error").mockImplementation(() => {})

        await runSurveyDaily(dailyEnv(assetsWith(emptyConfig())), NOW)

        expect(await countRows("survey_answers", "group-00")).toBe(1)
        expect(await countRows("survey_answers", "group-19")).toBe(1)
        expect(await countRows("survey_answers", "group-20")).toBe(0)
        expect(await countRows("survey_respondents", "group-24")).toBe(0)
        expect(deleteBatch).toBe(2)
        expect(batch).toHaveBeenCalledTimes(3)
        const log = output.mock.calls.flat().join(" ")
        expect(log).toContain("group-00")
        expect(log).toContain("group-19")
        expect(log).toContain("error=TypeError")
        expect(log).not.toContain("private D1 failure")
        batch.mockRestore()
        output.mockRestore()
    })

    it("does not read or delete when the index is invalid and sends no empty batches", async () => {
        vi.stubEnv("PUBLIC_SURVEY_CONFIG_PRESENT", "false")
        await bucket.put(INDEX_KEY, '{"privateIndexMarker":"secret"')
        const batch = vi.spyOn(db, "batch")
        const output = vi.spyOn(console, "error").mockImplementation(() => {})

        await runSurveyDaily(dailyEnv(assetsWith(emptyConfig())), NOW)

        expect(batch).not.toHaveBeenCalled()
        expect(output.mock.calls.flat().join(" ")).not.toContain("secret")
        await deletableBucket.delete(INDEX_KEY)

        await runSurveyDaily(dailyEnv(assetsWith(emptyConfig())), NOW)

        expect(batch).not.toHaveBeenCalled()
        batch.mockRestore()
        output.mockRestore()
    })

    it("leaves open residual entries and sends no deletion batch for an absent id", async () => {
        vi.stubEnv("PUBLIC_SURVEY_CONFIG_PRESENT", "false")
        const closedId = "orphan-closed"
        const openId = "orphan-open"
        await setIndex([
            {
                id: closedId,
                closesAt: "2026-12-01T00:00:00Z",
                outcome: "empty",
            },
            { id: openId, closesAt: "2026-12-03T00:00:00Z", outcome: "empty" },
        ])
        await insertRows(openId)
        const batch = vi.spyOn(db, "batch")

        await runSurveyDaily(dailyEnv(assetsWith(emptyConfig())), NOW)

        expect(batch).toHaveBeenCalledTimes(1)
        expect(await countRows("survey_answers", closedId)).toBe(0)
        expect(await countRows("survey_answers", openId)).toBe(1)
        expect(await countRows("survey_respondents", openId)).toBe(1)
        batch.mockRestore()
    })
})
