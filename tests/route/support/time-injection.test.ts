// 時刻の注入（要件 5.2）: テストが fake timers で現在時刻を決める（workerd）
import { afterEach, describe, expect, it, vi } from "vitest"

describe("time injection (workerd)", () => {
    afterEach(() => {
        vi.useRealTimers()
    })

    it("fixes Date.now and new Date from the test", () => {
        vi.useFakeTimers({ toFake: ["Date"] })
        vi.setSystemTime(new Date("2026-11-01T00:00:00Z"))
        expect(Date.now()).toBe(Date.parse("2026-11-01T00:00:00Z"))
        expect(new Date().toISOString()).toBe("2026-11-01T00:00:00.000Z")
    })
})
