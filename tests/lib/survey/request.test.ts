import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { resetSurveyConfigCache } from "@/lib/survey/loadConfig"
import {
    noStoreEmpty,
    noStoreJson,
    resolveSurveyRequest,
} from "@/lib/survey/request"

import { createValidConfig } from "../../fixtures/survey/config"

const getSurveyEnvMock = vi.hoisted(() => vi.fn())
vi.mock("@/lib/survey/env", () => ({ getSurveyEnv: getSurveyEnvMock }))

const IN_PERIOD = new Date("2026-11-15T00:00:00+09:00")
const BEFORE = new Date("2026-10-01T00:00:00+09:00")

/** D1 が呼ばれたかを検知できるフェイクの環境を作る */
const makeEnv = (
    options: { config?: unknown; key?: string; assetsStatus?: number } = {},
) => {
    const prepare = vi.fn()
    const batch = vi.fn()
    const assetsFetch = vi.fn(async () =>
        options.config === undefined
            ? new Response("", { status: options.assetsStatus ?? 404 })
            : new Response(JSON.stringify(options.config), { status: 200 }),
    )
    getSurveyEnvMock.mockResolvedValue({
        DB: { prepare, batch },
        ASSETS: { fetch: assetsFetch },
        SURVEY_HASH_KEY: options.key,
    })
    return { prepare, batch, assetsFetch }
}

const call = (
    over: {
        session?: { did: string } | null
        surveyId?: string
        now?: Date
    } = {},
) =>
    resolveSurveyRequest({
        request: new Request("https://example.test/v2/surveys/x/respondent"),
        params: { surveyId: over.surveyId ?? "survey-2026-a" },
        locals: over.session === null ? {} : { session: { did: "did:plc:a" } },
        now: over.now ?? IN_PERIOD,
    })

const expectFail = async (
    result: Awaited<ReturnType<typeof call>>,
    status: number,
) => {
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.response.status).toBe(status)
    expect(result.response.headers.get("cache-control")).toBe("no-store")
}

beforeEach(() => {
    vi.stubEnv("PUBLIC_SURVEY_CONFIG_PRESENT", "true")
    resetSurveyConfigCache()
    getSurveyEnvMock.mockReset()
})
afterEach(() => {
    vi.unstubAllEnvs()
})

describe("resolveSurveyRequest", () => {
    it("[survey-api/1.1] 未認証は 401 で、バインディングの取得にも D1 にも触れない", async () => {
        const env = makeEnv({ config: createValidConfig(), key: "k" })
        await expectFail(await call({ session: null }), 401)
        expect(getSurveyEnvMock).not.toHaveBeenCalled()
        expect(env.prepare).not.toHaveBeenCalled()
        expect(env.batch).not.toHaveBeenCalled()
    })

    it("[survey-api/1.4] 不正な識別子の形式は 400 で設定も読まない", async () => {
        const env = makeEnv({ config: createValidConfig(), key: "k" })
        await expectFail(await call({ surveyId: "Bad ID!" }), 400)
        expect(getSurveyEnvMock).not.toHaveBeenCalled()
        expect(env.assetsFetch).not.toHaveBeenCalled()
        expect(env.prepare).not.toHaveBeenCalled()
    })

    it("[survey-api/1.4] 識別子が無いときも 400", async () => {
        makeEnv({ config: createValidConfig(), key: "k" })
        const result = await resolveSurveyRequest({
            request: new Request("https://example.test/"),
            params: {},
            locals: { session: { did: "did:plc:a" } },
            now: IN_PERIOD,
        })
        await expectFail(result, 400)
    })

    it("[survey-api/2.3] 設定が無い（取得失敗）は 404", async () => {
        const env = makeEnv({ key: "k" })
        await expectFail(await call(), 404)
        expect(env.prepare).not.toHaveBeenCalled()
    })

    it("[survey-api/2.3] ビルドの旗が偽なら静的アセットにも触れず 404", async () => {
        vi.stubEnv("PUBLIC_SURVEY_CONFIG_PRESENT", "")
        const env = makeEnv({ config: createValidConfig(), key: "k" })
        await expectFail(await call(), 404)
        expect(env.assetsFetch).not.toHaveBeenCalled()
    })

    it("[survey-api/2.1] 設定にない識別子は 404", async () => {
        const env = makeEnv({ config: createValidConfig(), key: "k" })
        await expectFail(await call({ surveyId: "unknown-id" }), 404)
        expect(env.prepare).not.toHaveBeenCalled()
    })

    it("[survey-api/2.2] 期間外（開始前）は 404", async () => {
        const env = makeEnv({ config: createValidConfig(), key: "k" })
        await expectFail(await call({ now: BEFORE }), 404)
        expect(env.prepare).not.toHaveBeenCalled()
        expect(env.batch).not.toHaveBeenCalled()
    })

    it("[survey-api/2.2] 設定にあるが現在のアンケートでない識別子は 404", async () => {
        makeEnv({ config: createValidConfig(), key: "k" })
        const config = createValidConfig()
        const other = config.surveys[1].id
        await expectFail(await call({ surveyId: other }), 404)
    })

    it("[survey-api/2.5] 鍵が未設定または空なら 503 で D1 に触れない", async () => {
        const env = makeEnv({ config: createValidConfig() })
        await expectFail(await call(), 503)
        makeEnv({ config: createValidConfig(), key: "" })
        await expectFail(await call(), 503)
        expect(env.prepare).not.toHaveBeenCalled()
    })

    it("[survey-api/2.4] 期間内で通り、文脈に survey・did・db・鍵・時刻が入る", async () => {
        const env = makeEnv({ config: createValidConfig(), key: "secret" })
        const result = await call()
        expect(result.ok).toBe(true)
        if (!result.ok) return
        expect(result.context.survey.id).toBe("survey-2026-a")
        expect(result.context.did).toBe("did:plc:a")
        expect(result.context.hashKey).toBe("secret")
        expect(result.context.now).toEqual(IN_PERIOD)
        expect(result.context.db).toBeDefined()
        expect(env.prepare).not.toHaveBeenCalled()
        expect(env.batch).not.toHaveBeenCalled()
    })

    it("[survey-api/1.2] did はセッションからだけ得る（クエリや params の did は無視）", async () => {
        makeEnv({ config: createValidConfig(), key: "k" })
        const result = await resolveSurveyRequest({
            request: new Request("https://example.test/?did=did:plc:evil"),
            params: { surveyId: "survey-2026-a", did: "did:plc:evil" },
            locals: { session: { did: "did:plc:real" } },
            now: IN_PERIOD,
        })
        expect(result.ok && result.context.did).toBe("did:plc:real")
    })

    it("[survey-api/9.4] 鍵の値を失敗の応答に含めない", async () => {
        makeEnv({ config: createValidConfig(), key: "super-secret-key" })
        const result = await call({ surveyId: "unknown-id" })
        if (result.ok) throw new Error("unexpected")
        expect(await result.response.text()).not.toContain("super-secret-key")
    })

    it("[survey-api/1.1] 判定の順序: 未認証は不正な識別子より先（401）、識別子の不正は設定なしより先（400）", async () => {
        makeEnv({ key: "k" })
        await expectFail(
            await call({ session: null, surveyId: "Bad ID!" }),
            401,
        )
        await expectFail(await call({ surveyId: "Bad ID!" }), 400)
    })

    it("[survey-api/2.3] 鍵なしと設定なしが同時なら 404（設定の判定が鍵より先）", async () => {
        const env = makeEnv({})
        await expectFail(await call(), 404)
        expect(env.prepare).not.toHaveBeenCalled()
    })

    it("[survey-api/2.2] 鍵なしでも期間外・未定義は 404（503 にならない）", async () => {
        makeEnv({ config: createValidConfig() })
        await expectFail(await call({ now: BEFORE }), 404)
        await expectFail(await call({ surveyId: "unknown-id" }), 404)
    })
})

describe("noStoreJson / noStoreEmpty", () => {
    it("[survey-api/1.3] noStoreJson は既定 200 で JSON と no-store を付ける", async () => {
        const res = noStoreJson({ answered: true })
        expect(res.status).toBe(200)
        expect(res.headers.get("cache-control")).toBe("no-store")
        expect(res.headers.get("content-type")).toContain("application/json")
        expect(await res.json()).toEqual({ answered: true })
        expect(noStoreJson({}, 201).status).toBe(201)
    })

    it("[survey-api/1.3] noStoreEmpty は本文なしで no-store を付ける", async () => {
        const res = noStoreEmpty(204)
        expect(res.status).toBe(204)
        expect(res.headers.get("cache-control")).toBe("no-store")
        expect(await res.text()).toBe("")
    })
})
