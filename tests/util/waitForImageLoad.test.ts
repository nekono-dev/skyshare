import { afterEach, describe, expect, it, vi } from "vitest"

import { waitForImageLoad } from "@/util/waitForImageLoad"

// Image の最小の代替。results の順に、読み込みの成功と失敗を非同期に通知する
const stubImage = (results: boolean[]) => {
    let call = 0
    class FakeImage {
        onload: (() => void) | null = null
        onerror: (() => void) | null = null
        set src(_value: string) {
            const ok = results[Math.min(call, results.length - 1)]
            call += 1
            queueMicrotask(() => (ok ? this.onload?.() : this.onerror?.()))
        }
    }
    vi.stubGlobal("Image", FakeImage)
    return () => call
}

afterEach(() => {
    vi.unstubAllGlobals()
    vi.useRealTimers()
})

describe("waitForImageLoad", () => {
    it("[browser-utils/3.1] 読み込めたとき、true を返す", async () => {
        stubImage([true])
        expect(await waitForImageLoad("https://example.com/a.png")).toBe(true)
    })

    it("[browser-utils/3.2] 読み込みに失敗したあと、間隔を空けて再試行し、読み込めたら true を返す", async () => {
        vi.useFakeTimers()
        const calls = stubImage([false, false, true])
        const promise = waitForImageLoad("https://example.com/a.png", {
            intervalMs: 1000,
            timeoutMs: 10000,
        })
        await vi.advanceTimersByTimeAsync(2000)
        expect(await promise).toBe(true)
        expect(calls()).toBe(3)
    })

    it("[browser-utils/3.3] 全体の上限を超えたとき、例外を投げずに false を返す", async () => {
        vi.useFakeTimers()
        stubImage([false])
        const promise = waitForImageLoad("https://example.com/a.png", {
            intervalMs: 1000,
            timeoutMs: 3000,
        })
        await vi.advanceTimersByTimeAsync(5000)
        expect(await promise).toBe(false)
    })

    it("[browser-utils/3.4] URLが空のとき、false を返す", async () => {
        stubImage([true])
        expect(await waitForImageLoad("")).toBe(false)
    })
})
