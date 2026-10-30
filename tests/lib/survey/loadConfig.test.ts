import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import {
    fetchSurveyConfig,
    isSurveyConfigPresent,
    readSurveyConfig,
    resetSurveyConfigCache,
} from "@/lib/survey/loadConfig"

import { createValidConfig } from "../../fixtures/survey/config"

const jsonResponse = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status })

beforeEach(() => {
    resetSurveyConfigCache()
})

afterEach(() => {
    vi.unstubAllEnvs()
    vi.useRealTimers()
})

describe("isSurveyConfigPresent", () => {
    it("[survey-definition/4.1] 未定義と true 以外は偽、true は真", () => {
        vi.stubEnv("PUBLIC_SURVEY_CONFIG_PRESENT", "true")
        expect(isSurveyConfigPresent()).toBe(true)
        vi.stubEnv("PUBLIC_SURVEY_CONFIG_PRESENT", "false")
        expect(isSurveyConfigPresent()).toBe(false)
        vi.stubEnv("PUBLIC_SURVEY_CONFIG_PRESENT", "")
        expect(isSurveyConfigPresent()).toBe(false)
    })
})

describe("fetchSurveyConfig（画面側）", () => {
    it("[survey-definition/4.1] 旗が偽なら取得関数を呼ばず なし", async () => {
        const fetcher = vi.fn()
        expect(await fetchSurveyConfig({ present: false, fetcher })).toBe(
            undefined,
        )
        expect(fetcher).not.toHaveBeenCalled()
    })

    it("[survey-definition/4.1] 旗を省くとビルドの旗を使う（未定義なら通信しない）", async () => {
        vi.stubEnv("PUBLIC_SURVEY_CONFIG_PRESENT", "")
        const fetcher = vi.fn()
        expect(await fetchSurveyConfig({ fetcher })).toBe(undefined)
        expect(fetcher).not.toHaveBeenCalled()
    })

    it("[survey-definition/4.2] 旗が真で有効なら再検証つきで取得し設定を返す", async () => {
        const config = createValidConfig()
        const fetcher = vi.fn(async () => jsonResponse(config))
        const result = await fetchSurveyConfig({
            present: true,
            fetcher: fetcher as unknown as typeof fetch,
        })
        expect(result).toEqual(config)
        expect(fetcher).toHaveBeenCalledWith("/surveys/index.json", {
            cache: "reload",
        })
    })

    it("[survey-definition/4.2] 404・通信エラー・解析失敗・検証失敗はすべてなしで例外を投げない", async () => {
        const cases: Array<() => Promise<Response>> = [
            async () => new Response("", { status: 404 }),
            async () => {
                throw new TypeError("network")
            },
            async () => new Response("{not json", { status: 200 }),
            async () => jsonResponse({ surveys: [{ id: "BAD" }] }),
        ]
        for (const fetcher of cases) {
            await expect(
                fetchSurveyConfig({
                    present: true,
                    fetcher: fetcher as unknown as typeof fetch,
                }),
            ).resolves.toBe(undefined)
        }
    })
})

describe("readSurveyConfig（サーバー側）", () => {
    const origin = "https://example.invalid"

    it("[survey-definition/4.1] 旗が偽なら読み出さず なし", async () => {
        const assets = { fetch: vi.fn() }
        expect(await readSurveyConfig(assets, origin, { present: false })).toBe(
            undefined,
        )
        expect(assets.fetch).not.toHaveBeenCalled()
    })

    it("[survey-definition/4.2] 旗が真で有効なら静的アセットから読んで設定を返す", async () => {
        const config = createValidConfig()
        const assets = { fetch: vi.fn(async () => jsonResponse(config)) }
        expect(
            await readSurveyConfig(assets, origin, { present: true }),
        ).toEqual(config)
        expect(assets.fetch).toHaveBeenCalledWith(
            "https://example.invalid/surveys/index.json",
        )
    })

    it("[survey-definition/4.2] 404・読み出しエラー・解析失敗・検証失敗はすべてなしで例外を投げない", async () => {
        const cases: Array<() => Promise<Response>> = [
            async () => new Response("", { status: 404 }),
            async () => {
                throw new Error("assets")
            },
            async () => new Response("{not json", { status: 200 }),
            async () => jsonResponse({ surveys: "x" }),
        ]
        for (const fetchImpl of cases) {
            resetSurveyConfigCache()
            await expect(
                readSurveyConfig({ fetch: fetchImpl }, origin, {
                    present: true,
                }),
            ).resolves.toBe(undefined)
        }
    })

    it("[survey-definition/4.2] 成功した設定は 60 秒だけ保持し、過ぎたら読み直す", async () => {
        vi.useFakeTimers()
        vi.setSystemTime(new Date("2026-01-01T00:00:00Z"))
        const assets = {
            fetch: vi.fn(async () => jsonResponse(createValidConfig())),
        }
        await readSurveyConfig(assets, origin, { present: true })
        vi.advanceTimersByTime(59_000)
        await readSurveyConfig(assets, origin, { present: true })
        expect(assets.fetch).toHaveBeenCalledTimes(1)
        vi.advanceTimersByTime(2_000)
        await readSurveyConfig(assets, origin, { present: true })
        expect(assets.fetch).toHaveBeenCalledTimes(2)
    })

    it("[survey-definition/4.2] 失敗は保持せず、次の呼び出しで読み直す", async () => {
        const assets = {
            fetch: vi
                .fn()
                .mockResolvedValueOnce(new Response("", { status: 404 }))
                .mockResolvedValueOnce(jsonResponse(createValidConfig())),
        }
        expect(await readSurveyConfig(assets, origin, { present: true })).toBe(
            undefined,
        )
        expect(
            await readSurveyConfig(assets, origin, { present: true }),
        ).toEqual(createValidConfig())
    })

    it("[survey-definition/4.1] 旗が偽なら保持済みの設定も返さない", async () => {
        const assets = {
            fetch: vi.fn(async () => jsonResponse(createValidConfig())),
        }
        await readSurveyConfig(assets, origin, { present: true })
        expect(await readSurveyConfig(assets, origin, { present: false })).toBe(
            undefined,
        )
    })
})
