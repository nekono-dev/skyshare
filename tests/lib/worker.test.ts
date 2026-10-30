/**
 * Worker の scheduled ハンドラのテスト。
 *
 * 責務と処理概要:
 * - 日次の枠（日本時間 03:00）でだけアンケートの削除が起動されること、
 *   毎分の予約実行には何も足されないこと、削除の失敗が予約投稿の後片付けに影響しないことを確かめる。
 * - 実行本体はモックに差し替え、起動の有無と独立性だけを見る。
 */
import { beforeEach, describe, expect, test, vi } from "vitest"

const mocks = vi.hoisted(() => ({
    runScheduledPosts: vi.fn(async () => {}),
    runHousekeeping: vi.fn(async () => {}),
    runSurveyRetention: vi.fn(async () => {}),
}))

vi.mock("@astrojs/cloudflare/handler", () => ({ handle: vi.fn() }))
vi.mock("@/lib/schedule/runner", async importOriginal => ({
    ...(await importOriginal<typeof import("@/lib/schedule/runner")>()),
    runScheduledPosts: mocks.runScheduledPosts,
    runHousekeeping: mocks.runHousekeeping,
}))
vi.mock("@/lib/survey/retention", () => ({
    runSurveyRetention: mocks.runSurveyRetention,
}))

import worker from "@/worker"

/** 日次の枠（18:00 UTC = 03:00 JST）の予定時刻（ミリ秒） */
const DAILY = Date.UTC(2026, 9, 28, 18, 0, 20)

/**
 * scheduled を実行し、waitUntil に渡された Promise を待つ。
 *
 * Input: 予定時刻（ミリ秒）
 * Output: なし
 */
const run = async (scheduledTime: number): Promise<void> => {
    const pending: Promise<unknown>[] = []
    await worker.scheduled({ scheduledTime }, { DB: {}, ASSETS: {} } as never, {
        waitUntil: p => void pending.push(p),
    })
    await Promise.allSettled(pending)
}

describe("worker scheduled", () => {
    beforeEach(() => {
        vi.clearAllMocks()
        vi.spyOn(console, "error").mockImplementation(() => {})
    })

    test("[survey-api/8.3] 日次の枠では削除が env と現在時刻で 1 回呼ばれる", async () => {
        await run(DAILY)
        expect(mocks.runSurveyRetention).toHaveBeenCalledTimes(1)
        const [env, now] = mocks.runSurveyRetention.mock
            .calls[0] as unknown as [{ ASSETS: unknown; DB: unknown }, Date]
        expect(env).toHaveProperty("ASSETS")
        expect(env).toHaveProperty("DB")
        expect(now).toBeInstanceOf(Date)
    })

    test("[survey-api/8.3] 日次の枠以外の分では削除は呼ばれず、予約実行は毎分呼ばれる", async () => {
        await run(DAILY + 60_000)
        await run(DAILY - 60_000)
        expect(mocks.runSurveyRetention).not.toHaveBeenCalled()
        expect(mocks.runHousekeeping).not.toHaveBeenCalled()
        expect(mocks.runScheduledPosts).toHaveBeenCalledTimes(2)
    })

    test("[survey-api/8.6] 削除が失敗しても予約投稿の後片付けが実行される", async () => {
        mocks.runSurveyRetention.mockRejectedValueOnce(new Error("boom"))
        await run(DAILY)
        expect(mocks.runHousekeeping).toHaveBeenCalledTimes(1)
    })

    test("[survey-api/8.6] 後片付けが失敗しても削除は実行される", async () => {
        mocks.runHousekeeping.mockRejectedValueOnce(new Error("boom"))
        await run(DAILY)
        expect(mocks.runSurveyRetention).toHaveBeenCalledTimes(1)
    })

    test("[survey-api/8.8] 同期的に投げられても他方が実行される", async () => {
        mocks.runSurveyRetention.mockImplementationOnce(() => {
            throw new Error("sync")
        })
        await run(DAILY)
        expect(mocks.runHousekeeping).toHaveBeenCalledTimes(1)
    })
})
