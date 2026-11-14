/**
 * Worker の Cron 登録が日次処理ごとに分離されることを確かめる。
 */
import { afterEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
    runHousekeeping: vi.fn(),
    runScheduledPosts: vi.fn(),
    runSurveyDaily: vi.fn(),
}))

vi.mock("@astrojs/cloudflare/handler", () => ({ handle: vi.fn() }))
vi.mock("@/lib/survey/daily", () => ({ runSurveyDaily: mocks.runSurveyDaily }))
vi.mock("@/lib/schedule/runner", async importOriginal => {
    const actual =
        await importOriginal<typeof import("@/lib/schedule/runner")>()
    return {
        ...actual,
        runHousekeeping: mocks.runHousekeeping,
        runScheduledPosts: mocks.runScheduledPosts,
    }
})

import worker from "../../../src/worker"

describe("scheduled Worker", () => {
    afterEach(() => vi.resetAllMocks())

    it("日次の時刻に予約投稿・後片付け・アンケートを別々に登録する", async () => {
        mocks.runHousekeeping.mockResolvedValue(undefined)
        mocks.runScheduledPosts.mockResolvedValue(undefined)
        mocks.runSurveyDaily.mockResolvedValue(undefined)
        const promises: Promise<unknown>[] = []
        const env = {} as Parameters<typeof worker.scheduled>[1]

        await worker.scheduled(
            { scheduledTime: Date.parse("2026-11-13T18:00:20Z") },
            env,
            { waitUntil: promise => promises.push(promise) },
        )

        expect(mocks.runSurveyDaily).toHaveBeenCalledTimes(1)
        expect(mocks.runHousekeeping).toHaveBeenCalledTimes(1)
        expect(mocks.runScheduledPosts).toHaveBeenCalledTimes(1)
        expect(promises).toHaveLength(3)
        await Promise.all(promises)
    })

    it("日次以外は予約投稿だけを登録しアンケートを起動しない", async () => {
        mocks.runScheduledPosts.mockResolvedValue(undefined)
        const promises: Promise<unknown>[] = []

        await worker.scheduled(
            { scheduledTime: Date.parse("2026-11-13T18:01:00Z") },
            {} as Parameters<typeof worker.scheduled>[1],
            { waitUntil: promise => promises.push(promise) },
        )

        expect(mocks.runSurveyDaily).not.toHaveBeenCalled()
        expect(mocks.runHousekeeping).not.toHaveBeenCalled()
        expect(mocks.runScheduledPosts).toHaveBeenCalledTimes(1)
        expect(promises).toHaveLength(1)
        await Promise.all(promises)
    })

    it("アンケート処理の同期 throw と reject を独立した waitUntil に閉じ込める", async () => {
        mocks.runHousekeeping.mockResolvedValue(undefined)
        mocks.runScheduledPosts.mockResolvedValue(undefined)
        mocks.runSurveyDaily.mockImplementationOnce(() => {
            throw new Error("sync failure")
        })
        const promises: Promise<unknown>[] = []
        const ctx = {
            waitUntil: (promise: Promise<unknown>) => promises.push(promise),
        }

        let scheduled: Promise<void> | undefined
        expect(() => {
            scheduled = worker.scheduled(
                { scheduledTime: Date.parse("2026-11-13T18:00:20Z") },
                {} as Parameters<typeof worker.scheduled>[1],
                ctx,
            )
        }).not.toThrow()
        await scheduled
        expect(promises).toHaveLength(3)
        await expect(promises[2]).rejects.toThrow("sync failure")
        await Promise.all([promises[0], promises[1]])
    })
})
