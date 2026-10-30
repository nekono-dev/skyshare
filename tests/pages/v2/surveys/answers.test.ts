import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { resetSurveyConfigCache } from "@/lib/survey/loadConfig"
import { POST } from "@/pages/v2/surveys/[surveyId]/answers"
import { createFakeD1, type FakeD1 } from "../../../helpers/fakeD1"
import { createValidConfig } from "../../../fixtures/survey/config"

const getSurveyEnvMock = vi.hoisted(() => vi.fn())
vi.mock("@/lib/survey/env", () => ({ getSurveyEnv: getSurveyEnvMock }))

const KEY = "AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8="
const SURVEY = "survey-2026-a"
const GOOD = { "q-purpose": "share", "q-features": ["b", "a"] }

/** 静的アセットのフェイク。設定を返す */
const makeAssets = (config: unknown = createValidConfig()) => ({
    fetch: vi.fn(async () =>
        config === undefined
            ? new Response("", { status: 404 })
            : new Response(JSON.stringify(config), { status: 200 }),
    ),
})

let db: FakeD1

const useEnv = (over: { key?: string | undefined; config?: unknown } = {}) => {
    getSurveyEnvMock.mockResolvedValue({
        DB: db,
        ASSETS: makeAssets("config" in over ? over.config : undefined),
        SURVEY_HASH_KEY: "key" in over ? over.key : KEY,
    })
}

const post = (
    body: unknown,
    over: { did?: string | null; surveyId?: string; raw?: string } = {},
) =>
    POST({
        request: new Request(
            `https://example.test/v2/surveys/${SURVEY}/answers/`,
            {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: over.raw ?? JSON.stringify(body),
            },
        ),
        params: { surveyId: over.surveyId ?? SURVEY },
        locals:
            over.did === null
                ? {}
                : { session: { did: over.did ?? "did:plc:a" } },
    } as unknown as Parameters<typeof POST>[0]) as Promise<Response>

const rows = (table: string) =>
    db.prepare(`SELECT * FROM ${table}`).all<Record<string, unknown>>()

const count = async (table: string) => (await rows(table)).results.length

beforeEach(() => {
    vi.stubEnv("PUBLIC_SURVEY_CONFIG_PRESENT", "true")
    vi.useFakeTimers({ toFake: ["Date"] })
    vi.setSystemTime(new Date("2026-11-15T00:00:00+09:00"))
    resetSurveyConfigCache()
    getSurveyEnvMock.mockReset()
    db = createFakeD1()
    useEnv({ config: createValidConfig() })
})
afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
})

describe("POST /v2/surveys/{surveyId}/answers/", () => {
    it("[survey-api/6.1][survey-api/1.3] 成功は本文なしの 201 で、no-store、両表に 1 行ずつ入る", async () => {
        const res = await post({ answers: GOOD })
        expect(res.status).toBe(201)
        expect(await res.text()).toBe("")
        expect(res.headers.get("cache-control")).toBe("no-store")
        expect(await count("survey_respondents")).toBe(1)
        const saved = (await rows("survey_answers")).results[0]
        expect(saved.survey_id).toBe(SURVEY)
        expect(saved.answers).toBe(
            JSON.stringify({ "q-purpose": "share", "q-features": ["a", "b"] }),
        )
        expect(saved.answered_on).toBe("2026-11-15")
        expect(String(saved.id)).toMatch(/^[0-9a-f-]{36}$/)
    })

    it("[survey-api/7.1] 同じアカウントの 2 回目は 409 で、回答は増えない", async () => {
        expect((await post({ answers: GOOD })).status).toBe(201)
        const res = await post({ answers: GOOD })
        expect(res.status).toBe(409)
        expect(res.headers.get("cache-control")).toBe("no-store")
        expect(await count("survey_answers")).toBe(1)
    })

    it("[survey-api/7.2] 登録だけ済ませたアカウントは 409 で、回答は残らない", async () => {
        const { respondentHash } = await import("@/lib/survey/respondentHash")
        const { registerRespondent } = await import("@/lib/survey/store")
        await registerRespondent(
            db,
            SURVEY,
            await respondentHash(KEY, SURVEY, "did:plc:a"),
        )
        const res = await post({ answers: GOOD })
        expect(res.status).toBe(409)
        expect(await count("survey_answers")).toBe(0)
    })

    it("[survey-api/7.3] 別のアカウントは成功する", async () => {
        expect((await post({ answers: GOOD })).status).toBe(201)
        expect(
            (await post({ answers: GOOD }, { did: "did:plc:b" })).status,
        ).toBe(201)
        expect(await count("survey_answers")).toBe(2)
    })

    it("[survey-api/7.4] 同時の 2 要求で 1 件だけが保存される", async () => {
        const results = await Promise.all([
            post({ answers: GOOD }),
            post({ answers: GOOD }),
        ])
        expect(results.map(r => r.status).sort()).toEqual([201, 409])
        expect(await count("survey_answers")).toBe(1)
        expect(await count("survey_respondents")).toBe(1)
    })

    it("[survey-api/5.7] 「回答しない」を含む回答は 422 で何も保存されない", async () => {
        const res = await post({
            answers: { "q-purpose": "none", "q-features": ["a"] },
        })
        expect(res.status).toBe(422)
        expect(res.headers.get("cache-control")).toBe("no-store")
        expect(await count("survey_respondents")).toBe(0)
        expect(await count("survey_answers")).toBe(0)
    })

    it.each([
        ["質問の不足", { answers: { "q-purpose": "share" } }],
        ["無い質問", { answers: { ...GOOD, "q-x": "a" } }],
        ["無い選択肢", { answers: { ...GOOD, "q-purpose": "zzz" } }],
        ["単一選択に配列", { answers: { ...GOOD, "q-purpose": ["share"] } }],
        ["複数選択の空", { answers: { ...GOOD, "q-features": [] } }],
        ["複数選択の重複", { answers: { ...GOOD, "q-features": ["a", "a"] } }],
        [
            "複数選択の上限超過",
            { answers: { ...GOOD, "q-features": ["a", "b", "c"] } },
        ],
        ["定義にない項目", { answers: GOOD, did: "x" }],
        ["answers が無い", {}],
    ])(
        "[survey-api/5.1] 構造の不正（%s）は 400 で何も保存されない",
        async (_n, body) => {
            const res = await post(body)
            expect(res.status).toBe(400)
            expect(res.headers.get("cache-control")).toBe("no-store")
            expect(await count("survey_respondents")).toBe(0)
            expect(await count("survey_answers")).toBe(0)
        },
    )

    it("[survey-api/1.3] 壊れた JSON は 400", async () => {
        const res = await post(undefined, { raw: "{not json" })
        expect(res.status).toBe(400)
    })

    it("[survey-api/1.1] 未認証は 401、期間外・別のアンケートは 404、鍵なしは 503（DB に触れない）", async () => {
        const before = db.queryCount
        expect((await post({ answers: GOOD }, { did: null })).status).toBe(401)
        expect(
            (await post({ answers: GOOD }, { surveyId: "survey-2026-b" }))
                .status,
        ).toBe(404)
        useEnv({ key: undefined, config: createValidConfig() })
        expect((await post({ answers: GOOD })).status).toBe(503)
        vi.setSystemTime(new Date("2026-10-01T00:00:00+09:00"))
        useEnv({ config: createValidConfig() })
        expect((await post({ answers: GOOD })).status).toBe(404)
        expect(db.queryCount).toBe(before)
    })

    it("[survey-api/6.2][survey-api/6.5] 保存された両表の行から did が見つからない", async () => {
        await post({ answers: GOOD }, { did: "did:plc:secret123" })
        const dump = JSON.stringify([
            ...(await rows("survey_respondents")).results,
            ...(await rows("survey_answers")).results,
        ])
        expect(dump).not.toContain("did:plc")
        expect(dump).not.toContain("secret123")
        expect(dump).not.toContain(KEY)
    })

    it("[survey-api/7.5] 事前の読み取りは無く、保存は 1 回の原子的な呼び出しだけ", async () => {
        const before = db.queryCount
        await post({ answers: GOOD })
        expect(db.queryCount - before).toBe(1)
    })

    it("[survey-api/1.5] 保存の予期しない失敗は内部情報を含まない 500 で、ログに did・内容・鍵を含まない", async () => {
        const spy = vi.spyOn(console, "error").mockImplementation(() => {})
        const secret = `boom did:plc:a share ${KEY}`
        db.batch = async () => {
            throw new Error(secret)
        }
        const res = await post({ answers: GOOD })
        expect(res.status).toBe(500)
        expect(res.headers.get("cache-control")).toBe("no-store")
        const text = await res.text()
        expect(text).not.toContain("boom")
        const { respondentHash } = await import("@/lib/survey/respondentHash")
        const hash = await respondentHash(KEY, SURVEY, "did:plc:a")
        expect(spy).toHaveBeenCalled()
        for (const call of spy.mock.calls) {
            for (const arg of call) {
                // Error オブジェクトをそのまま出していないこと
                expect(typeof arg).toBe("string")
                for (const word of ["did:plc", hash, KEY, "share", "boom"]) {
                    expect(String(arg)).not.toContain(word)
                }
            }
        }
    })

    it("[survey-api/1.5] バインディングの取得の例外も 500", async () => {
        vi.spyOn(console, "error").mockImplementation(() => {})
        getSurveyEnvMock.mockRejectedValue(new Error("no binding"))
        const res = await post({ answers: GOOD })
        expect(res.status).toBe(500)
        expect(res.headers.get("cache-control")).toBe("no-store")
    })
})
