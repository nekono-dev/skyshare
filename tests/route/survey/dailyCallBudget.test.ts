/**
 * アンケート日次処理の D1 への送信回数が、最悪の場合でも上限に収まることを確かめる。
 */
import { env } from "cloudflare:test"
import type { D1Database, SurveyResultsBucket } from "@/lib/platform/cfTypes"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { resetSurveyConfigCache } from "@/lib/survey/loadConfig"
import { runSurveyDaily } from "@/lib/survey/daily"
import { createValidSurveyConfig } from "../../fixtures/survey/config"
import { INDEX_KEY } from "@/lib/survey/results/schema"

const NOW = new Date("2026-12-02T00:00:00Z")
const DID_HASH = "f".repeat(64)
const db = env.DB as unknown as D1Database
const bucket = env.SURVEY_RESULTS as unknown as SurveyResultsBucket & {
    delete(key: string): Promise<void>
}

/** 設計の上限: 集合の削除 1 + 読み取り 1 + 設定内の回答の削除 1 + 掃除の削除 10 */
const WORST_CASE_SENDS = 13
const SEND_LIMIT = 16

const orphanIds = Array.from(
    { length: 200 },
    (_, index) => `orphan-${String(index).padStart(3, "0")}`,
)

/** D1 への送信（batch と、文の直接実行）を数える。batch に渡す文は元の文へ戻す */
const countingDb = () => {
    const sends = { batchSizes: [] as number[], direct: 0 }
    const originals = new WeakMap<object, unknown>()
    const wrap = (statement: any): any => {
        const wrapped = new Proxy(statement, {
            get(target, property) {
                if (property === "bind")
                    return (...args: unknown[]) => wrap(target.bind(...args))
                if (["run", "first", "all", "raw"].includes(String(property)))
                    return (...args: unknown[]) => {
                        sends.direct += 1
                        return target[property](...args)
                    }
                const value = target[property]
                return typeof value === "function" ? value.bind(target) : value
            },
        })
        originals.set(wrapped, statement)
        return wrapped
    }
    let failOn = new Set<number>()
    const counting = {
        prepare: (sql: string) => wrap(db.prepare(sql)),
        batch: async (statements: object[]) => {
            sends.batchSizes.push(statements.length)
            if (failOn.has(sends.batchSizes.length))
                throw new TypeError("private D1 failure")
            return await db.batch(
                statements.map(
                    statement => originals.get(statement) ?? statement,
                ) as never,
            )
        },
    } as unknown as D1Database
    return {
        counting,
        sends,
        failOnCalls: (calls: number[]) => {
            failOn = new Set(calls)
        },
    }
}

const seedWorstCase = async (): Promise<void> => {
    const closesAt = "2026-12-01T00:00:00Z"
    await bucket.put(
        INDEX_KEY,
        JSON.stringify({
            schemaVersion: 1,
            surveys: orphanIds.map(id => ({
                id,
                opensAt: "2026-01-01T00:00:00Z",
                closesAt,
                outcome: "empty",
            })),
        }),
    )
    const surveyIds = ["survey-2026-a", ...orphanIds]
    await Promise.all(
        surveyIds.flatMap(id => [
            db
                .prepare(
                    "INSERT INTO survey_respondents (survey_id, did_hash) VALUES (?, ?)",
                )
                .bind(id, DID_HASH)
                .run(),
            db
                .prepare(
                    "INSERT INTO survey_answers (survey_id, id, answers, answered_on) VALUES (?, ?, ?, ?)",
                )
                .bind(
                    id,
                    crypto.randomUUID(),
                    '{"q-purpose":"share"}',
                    "2026-11-30",
                )
                .run(),
        ]),
    )
}

const fakeAssets = () => ({
    fetch: vi.fn(
        async () =>
            new Response(JSON.stringify(createValidSurveyConfig()), {
                status: 200,
                headers: { "content-type": "application/json" },
            }),
    ),
})

describe("survey daily D1 call budget", () => {
    beforeEach(async () => {
        vi.unstubAllEnvs()
        vi.restoreAllMocks()
        resetSurveyConfigCache()
        vi.stubEnv("PUBLIC_SURVEY_CONFIG_PRESENT", "true")
        await db.prepare("DELETE FROM survey_answers").run()
        await db.prepare("DELETE FROM survey_respondents").run()
        await bucket.delete(INDEX_KEY)
    })

    it("sends at most 13 batches with 200 cleanup records, a saved result and a closed set", async () => {
        await seedWorstCase()
        const { counting, sends } = countingDb()

        await runSurveyDaily(
            { DB: counting, ASSETS: fakeAssets(), SURVEY_RESULTS: bucket },
            NOW,
        )

        // 集合の削除（1 文）→ 回答と残存の読み取り（回答 1 文 + 残存 200 件を 50 件ずつ 4 文 = 5 文、送信は 1 回）
        // → 設定内の削除（2 文）→ 掃除 10 回（各 2 文）。数えるのは文の数でなく送信の回数
        expect(sends.batchSizes).toEqual([1, 5, 2, ...Array(10).fill(2)])
        expect(sends.batchSizes.length).toBe(WORST_CASE_SENDS)
        expect(sends.batchSizes.length).toBeLessThanOrEqual(SEND_LIMIT)
        expect(sends.direct).toBe(0)
        const remaining = await db
            .prepare("SELECT COUNT(*) AS n FROM survey_answers")
            .first<{ n: number }>()
        expect(remaining?.n).toBe(0)
    })

    it("does not add retries or direct executions when batches fail", async () => {
        await seedWorstCase()
        const { counting, sends, failOnCalls } = countingDb()
        // 集合の削除(1)・設定内の削除(3)・掃除の途中(5, 9)が失敗する
        failOnCalls([1, 3, 5, 9])
        const output = vi.spyOn(console, "error").mockImplementation(() => {})

        await expect(
            runSurveyDaily(
                { DB: counting, ASSETS: fakeAssets(), SURVEY_RESULTS: bucket },
                NOW,
            ),
        ).resolves.toBeUndefined()

        expect(sends.batchSizes.length).toBe(WORST_CASE_SENDS)
        expect(sends.direct).toBe(0)
        expect(output.mock.calls.flat().join(" ")).not.toContain(
            "private D1 failure",
        )
    })
})
