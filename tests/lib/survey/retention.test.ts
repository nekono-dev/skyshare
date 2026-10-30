import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { resetSurveyConfigCache } from "@/lib/survey/loadConfig"
import { runSurveyRetention } from "@/lib/survey/retention"
import { registerRespondent, saveAnswer } from "@/lib/survey/store"
import { createFakeD1, type FakeD1 } from "../../helpers/fakeD1"
import { createValidConfig } from "../../fixtures/survey/config"

// A: 11/01〜12/01（JST）、回答の期限 1/01。B: 12/01〜1/01、回答の期限 2/01
const A = "survey-2026-a"
const B = "survey-2026-b"

const count = async (db: FakeD1, table: string, surveyId: string) => {
    const row = await db
        .prepare(`SELECT COUNT(*) AS n FROM ${table} WHERE survey_id = ?`)
        .bind(surveyId)
        .first<{ n: number }>()
    return row?.n ?? -1
}

const seed = async (db: FakeD1) => {
    for (const surveyId of [A, B]) {
        await saveAnswer(db, {
            surveyId,
            didHash: "h1",
            answerId: `a-${surveyId}`,
            answersJson: "{}",
            answeredOn: "2026-11-02",
        })
    }
}

const makeEnv = (
    db: FakeD1,
    config: unknown = createValidConfig(),
    notFound = false,
) => {
    const fetchMock = vi.fn(async () =>
        notFound
            ? new Response("", { status: 404 })
            : new Response(JSON.stringify(config)),
    )
    return { env: { DB: db, ASSETS: { fetch: fetchMock } }, fetchMock }
}

const sizes = async (db: FakeD1) => ({
    ar: await count(db, "survey_respondents", A),
    aa: await count(db, "survey_answers", A),
    br: await count(db, "survey_respondents", B),
    ba: await count(db, "survey_answers", B),
})

beforeEach(() => {
    resetSurveyConfigCache()
})

afterEach(() => {
    vi.restoreAllMocks()
})

describe("runSurveyRetention", () => {
    it("[survey-api/8.1][survey-api/8.4] 終了前は何も削除されない（開催中・未開催）", async () => {
        const db = createFakeD1()
        await seed(db)
        const { env } = makeEnv(db)
        await runSurveyRetention(env, new Date("2026-11-15T00:00:00+09:00"))
        expect(await sizes(db)).toEqual({ ar: 1, aa: 1, br: 1, ba: 1 })
    })

    it("[survey-api/8.1][survey-api/8.2][survey-api/8.4] 終了時刻ちょうどで集合だけ消え、回答と他のアンケートは残る", async () => {
        const db = createFakeD1()
        await seed(db)
        const { env } = makeEnv(db)
        await runSurveyRetention(env, new Date("2026-12-01T00:00:00+09:00"))
        expect(await sizes(db)).toEqual({ ar: 0, aa: 1, br: 1, ba: 1 })
    })

    it("[survey-api/8.2][survey-api/8.4] 1 か月後ちょうどで回答も消え、直前は回答が残り、他のアンケートの回答は残る", async () => {
        const db = createFakeD1()
        await seed(db)
        const { env } = makeEnv(db)
        await runSurveyRetention(env, new Date("2026-12-31T23:59:59+09:00"))
        expect(await sizes(db)).toEqual({ ar: 0, aa: 1, br: 1, ba: 1 })
        await runSurveyRetention(env, new Date("2027-01-01T00:00:00+09:00"))
        expect(await sizes(db)).toEqual({ ar: 0, aa: 0, br: 0, ba: 1 })
    })

    it("[survey-api/8.5] 設定が取得できないとき、D1 に触れず例外も投げない", async () => {
        const db = createFakeD1()
        const { env, fetchMock } = makeEnv(db, undefined, true)
        await expect(
            runSurveyRetention(env, new Date("2030-01-01T00:00:00Z")),
        ).resolves.toBeUndefined()
        expect(fetchMock).toHaveBeenCalled()
        expect(db.queryCount).toBe(0)
    })

    it("[survey-api/8.5] アンケートが無い設定でも D1 に触れない", async () => {
        const db = createFakeD1()
        const { env } = makeEnv(db, { surveys: [] })
        await runSurveyRetention(env, new Date("2030-01-01T00:00:00Z"))
        expect(db.queryCount).toBe(0)
    })

    it("[survey-api/8.5] 設定の読み出しが例外でも、D1 に触れず例外を投げない", async () => {
        const db = createFakeD1()
        vi.spyOn(console, "error").mockImplementation(() => {})
        const env = {
            DB: db,
            ASSETS: {
                fetch: async () => {
                    throw new Error("boom")
                },
            },
        }
        await expect(
            runSurveyRetention(env, new Date("2030-01-01T00:00:00Z")),
        ).resolves.toBeUndefined()
        expect(db.queryCount).toBe(0)
    })

    it("[survey-api/8.6] 1 件の失敗を記録して次へ進み、例外を外へ投げない", async () => {
        const db = createFakeD1()
        await seed(db)
        const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {})
        const realPrepare = db.prepare.bind(db)
        // 集合の削除だけを失敗させる（回答の削除と次のアンケートは通る）
        db.prepare = (sql: string) => {
            if (sql.includes("DELETE FROM survey_respondents")) {
                throw new Error("secret-detail")
            }
            return realPrepare(sql)
        }
        const { env } = makeEnv(db)
        await expect(
            runSurveyRetention(env, new Date("2027-03-01T00:00:00+09:00")),
        ).resolves.toBeUndefined()
        expect(await sizes(db)).toEqual({ ar: 1, aa: 0, br: 1, ba: 0 })
        expect(errorSpy).toHaveBeenCalledTimes(2)
        const logged = errorSpy.mock.calls.flat().join(" ")
        expect(logged).not.toContain("secret-detail")
    })

    it("[survey-api/8.7][survey-api/8.8] 繰り返しても結果が変わらず、失敗後の次回の実行で回収される", async () => {
        const db = createFakeD1()
        await seed(db)
        const { env } = makeEnv(db)
        const now = new Date("2027-03-01T00:00:00+09:00")
        await runSurveyRetention(env, now)
        const first = await sizes(db)
        await runSurveyRetention(env, now)
        expect(await sizes(db)).toEqual(first)
        expect(first).toEqual({ ar: 0, aa: 0, br: 0, ba: 0 })

        // 失敗した日の後、翌日の実行で残りが削除される
        await seed(db)
        await registerRespondent(db, A, "h2")
        const realPrepare = db.prepare.bind(db)
        db.prepare = () => {
            throw new Error("down")
        }
        vi.spyOn(console, "error").mockImplementation(() => {})
        await runSurveyRetention(env, now)
        expect((await sizesWith(db, realPrepare)).ar).toBe(2)
        db.prepare = realPrepare
        await runSurveyRetention(env, new Date("2027-03-02T00:00:00+09:00"))
        expect(await sizes(db)).toEqual({ ar: 0, aa: 0, br: 0, ba: 0 })
    })
})

const sizesWith = async (db: FakeD1, prepare: FakeD1["prepare"]) => {
    const original = db.prepare
    db.prepare = prepare
    try {
        return await sizes(db)
    } finally {
        db.prepare = original
    }
}
