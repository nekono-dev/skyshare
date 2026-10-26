import { afterEach, describe, expect, it, vi } from "vitest"

import {
    readTimelineHiddenSetting,
    writeTimelineHiddenSetting,
} from "@/lib/settings/timelineSettings"

/**
 * テスト用の最小限の localStorage 実装（メモリ上に値を保持するだけ）。
 */
const createMemoryLocalStorage = () => {
    const store = new Map<string, string>()
    return {
        getItem: (key: string) => store.get(key) ?? null,
        setItem: (key: string, value: string) => {
            store.set(key, value)
        },
        removeItem: (key: string) => {
            store.delete(key)
        },
    }
}

afterEach(() => {
    vi.unstubAllGlobals()
})

describe("readTimelineHiddenSetting / writeTimelineHiddenSetting", () => {
    it("[timeline-hidden/1.1] 保存した値を同じ値として読み取れる", () => {
        vi.stubGlobal("window", { localStorage: createMemoryLocalStorage() })
        writeTimelineHiddenSetting(true)
        expect(readTimelineHiddenSetting(false)).toBe(true)
        writeTimelineHiddenSetting(false)
        expect(readTimelineHiddenSetting(true)).toBe(false)
    })

    it("[timeline-hidden/1.1] 未保存・不正な値のときはdefaultValue（OFF）を返す", () => {
        const localStorage = createMemoryLocalStorage()
        vi.stubGlobal("window", { localStorage })
        expect(readTimelineHiddenSetting(false)).toBe(false)
        localStorage.setItem("timelineHidden", "yes")
        expect(readTimelineHiddenSetting(false)).toBe(false)
    })

    it("window が未定義・localStorage が例外を投げる場合はdefaultValueを返し、書き込みも例外を投げない", () => {
        expect(readTimelineHiddenSetting(false)).toBe(false)
        vi.stubGlobal("window", {
            localStorage: {
                getItem: () => {
                    throw new Error("denied")
                },
                setItem: () => {
                    throw new Error("denied")
                },
            },
        })
        expect(readTimelineHiddenSetting(false)).toBe(false)
        expect(() => writeTimelineHiddenSetting(true)).not.toThrow()
    })
})
