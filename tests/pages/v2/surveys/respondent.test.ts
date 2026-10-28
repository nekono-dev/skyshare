import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { APIContext } from "astro"
import { inspect } from "node:util"

import { respondentHash } from "@/lib/survey/respondentHash"
import { resetSurveyConfigCache } from "@/lib/survey/loadConfig"
import { createFakeD1, type FakeD1 } from "../../../helpers/fakeD1"
import { createValidConfig } from "../../../fixtures/survey/config"

const getSurveyEnvMock = vi.hoisted(() => vi.fn())
vi.mock("@/lib/survey/env", () => ({ getSurveyEnv: getSurveyEnvMock }))

import { GET, PUT } from "@/pages/v2/surveys/[surveyId]/respondent"

const KEY = btoa(String.fromCharCode(...new Uint8Array(32).fill(5)))
const SURVEY = "survey-2026-a"
const IN_PERIOD = new Date("2026-11-15T00:00:00+09:00")

type Handler = (c: APIContext) => Promise<Response>

/** ルートを呼ぶ。session を null にすると未認証 */
const call = (
    handler: unknown,
    over: { did?: string | null; surveyId?: string; body?: string } = {},
) =>
    (handler as Handler)({
        params: { surveyId: over.surveyId ?? SURVEY },
        locals:
            over.did === null
                ? {}
                : { session: { did: over.did ?? "did:plc:a" } },
        request: new Request(
            `http://localhost/v2/surveys/${SURVEY}/respondent/`,
            {
                method: handler === PUT ? "PUT" : "GET",
                body: over.body,
            },
        ),
    } as unknown as APIContext)

let db: FakeD1
let assetsFetch: ReturnType<typeof vi.fn>

const setEnv = (key: string | null = KEY) => {
    getSurveyEnvMock.mockResolvedValue({
        DB: db,
        ASSETS: { fetch: assetsFetch },
        SURVEY_HASH_KEY: key ?? undefined,
    })
}

beforeEach(() => {
    vi.stubEnv("PUBLIC_SURVEY_CONFIG_PRESENT", "true")
    vi.useFakeTimers({ toFake: ["Date"] })
    vi.setSystemTime(IN_PERIOD)
    resetSurveyConfigCache()
    getSurveyEnvMock.mockReset()
    db = createFakeD1()
    assetsFetch = vi.fn(
        async () => new Response(JSON.stringify(createValidConfig())),
    )
    setEnv()
})
afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
})

const expectNoStore = (res: Response) =>
    expect(res.headers.get("cache-control")).toBe("no-store")

/** console.error の全引数が文字列で、例外の中身・did・鍵を含まないことを確認する */
const expectSafeLog = (
    spy: { mock: { calls: unknown[][] } },
    detail: string,
) => {
    expect(spy.mock.calls.length).toBeGreaterThan(0)
    const text = spy.mock.calls
        .flat()
        .map(a => inspect(a, { depth: 5 }))
        .join("\n")
    for (const arg of spy.mock.calls.flat()) {
        expect(typeof arg).toBe("string")
    }
    for (const secret of [detail, "did:plc", KEY]) {
        expect(text).not.toContain(secret)
    }
}

describe("RespondentRoute", () => {
    it("[survey-api/3.1] 未回答の確認は 200 で answered が偽、読み取りは 1 回", async () => {
        const res = await call(GET)
        expect(res.status).toBe(200)
        expect(await res.json()).toEqual({ answered: false })
        expectNoStore(res)
        expect(db.queryCount).toBe(1)
    })

    it("[survey-api/4.1] 登録は 204 で本文なし、書き込みは 1 回", async () => {
        const res = await call(PUT)
        expect(res.status).toBe(204)
        expect(await res.text()).toBe("")
        expectNoStore(res)
        expect(db.queryCount).toBe(1)
    })

    it("[survey-api/3.2] 登録後の確認は answered が真", async () => {
        await call(PUT)
        const res = await call(GET)
        expect(await res.json()).toEqual({ answered: true })
    })

    it("[survey-api/4.1] 登録の繰り返しは同じ 204", async () => {
        expect((await call(PUT)).status).toBe(204)
        expect((await call(PUT)).status).toBe(204)
        expect(await (await call(GET)).json()).toEqual({ answered: true })
    })

    it("[survey-api/3.3] 別のアカウントは別の結果", async () => {
        await call(PUT, { did: "did:plc:a" })
        const other = await call(GET, { did: "did:plc:b" })
        expect(await other.json()).toEqual({ answered: false })
        await call(PUT, { did: "did:plc:b" })
        for (const did of ["did:plc:a", "did:plc:b"]) {
            const res = await call(GET, { did })
            expect(await res.json()).toEqual({ answered: true })
        }
    })

    it("[survey-api/4.3] PUT は本文を一切読まない", async () => {
        const request = new Request(
            `http://localhost/v2/surveys/${SURVEY}/respondent/`,
            { method: "PUT", body: "{broken" },
        )
        const reader = () => {
            throw new Error("本文を読んではならない")
        }
        for (const name of [
            "text",
            "json",
            "arrayBuffer",
            "blob",
            "formData",
        ]) {
            vi.spyOn(request, name as "text").mockImplementation(reader)
        }
        const bodyGetter = vi
            .spyOn(request, "body", "get")
            .mockImplementation(reader)
        const res = await (PUT as unknown as Handler)({
            params: { surveyId: SURVEY },
            locals: { session: { did: "did:plc:a" } },
            request,
        } as unknown as APIContext)
        expect(res.status).toBe(204)
        expect(bodyGetter).not.toHaveBeenCalled()
        expect(request.bodyUsed).toBe(false)
    })

    it("[survey-api/3.2] D1 に渡る値は did を含まず respondentHash と一致する", async () => {
        const binds: unknown[][] = []
        const realPrepare = db.prepare.bind(db)
        vi.spyOn(db, "prepare").mockImplementation(sql => {
            const st = realPrepare(sql)
            const bind = st.bind.bind(st)
            st.bind = (...args: unknown[]) => {
                binds.push(args)
                return bind(...(args as never[]))
            }
            return st
        })
        const did = "did:plc:a"
        const expected = await respondentHash(KEY, SURVEY, did)
        await call(PUT, { did })
        await call(GET, { did })
        expect(binds).toHaveLength(2)
        for (const args of binds) {
            expect(args).toEqual([SURVEY, expected])
            expect(JSON.stringify(args)).not.toContain(did)
        }
    })

    it("[survey-api/1.3] 未認証は 401 で D1 に触れない", async () => {
        for (const h of [GET, PUT]) {
            const res = await call(h, { did: null })
            expect(res.status).toBe(401)
            expectNoStore(res)
        }
        expect(db.queryCount).toBe(0)
    })

    it("[survey-api/1.3] 期間外は 404 で D1 に触れない", async () => {
        vi.setSystemTime(new Date("2027-01-01T00:00:00+09:00"))
        for (const h of [GET, PUT]) {
            const res = await call(h)
            expect(res.status).toBe(404)
            expectNoStore(res)
        }
        expect(db.queryCount).toBe(0)
    })

    it("[survey-api/1.3] 鍵が無いときは 503 で D1 に触れない", async () => {
        setEnv(null)
        const res = await call(GET)
        expect(res.status).toBe(503)
        expectNoStore(res)
        expect(db.queryCount).toBe(0)
    })

    it("[survey-api/1.5] バインディングの取得の失敗は内部情報のない 500", async () => {
        const spy = vi.spyOn(console, "error").mockImplementation(() => {})
        getSurveyEnvMock.mockRejectedValue(new Error("secret-detail"))
        for (const h of [GET, PUT]) {
            const res = await call(h)
            expect(res.status).toBe(500)
            expectNoStore(res)
            expect(await res.text()).not.toContain("secret-detail")
        }
        expectSafeLog(spy, "secret-detail")
    })

    it("[survey-api/1.5] D1 の失敗は内部情報のない 500", async () => {
        const spy = vi.spyOn(console, "error").mockImplementation(() => {})
        getSurveyEnvMock.mockResolvedValue({
            DB: {
                prepare: () => {
                    throw new Error("db-detail")
                },
            },
            ASSETS: { fetch: assetsFetch },
            SURVEY_HASH_KEY: KEY,
        })
        for (const h of [GET, PUT]) {
            const res = await call(h)
            expect(res.status).toBe(500)
            expectNoStore(res)
            expect(await res.text()).not.toContain("db-detail")
        }
        expectSafeLog(spy, "db-detail")
    })

    it("[survey-api/1.5] 不正な鍵は鍵を含まない 500", async () => {
        vi.spyOn(console, "error").mockImplementation(() => {})
        setEnv("not-base64-key!!")
        const res = await call(GET)
        expect(res.status).toBe(500)
        expect(await res.text()).not.toContain("not-base64")
    })
})
