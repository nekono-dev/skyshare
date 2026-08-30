import { afterEach, describe, expect, it, vi } from "vitest"

import {
    readHashtagSuggestEnabledSetting,
    readMentionSuggestEnabledSetting,
    writeHashtagSuggestEnabledSetting,
    writeMentionSuggestEnabledSetting,
} from "@/lib/settings/suggestSettings"

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

describe("readHashtagSuggestEnabledSetting", () => {
    it("window が未定義の場合はdefaultValueを返す", () => {
        expect(readHashtagSuggestEnabledSetting(true)).toBe(true)
    })

    it("未設定時はdefaultValueを返す", () => {
        vi.stubGlobal("window", { localStorage: createMemoryLocalStorage() })
        expect(readHashtagSuggestEnabledSetting(true)).toBe(true)
    })

    it("保存済みの値を読み取れる", () => {
        const localStorage = createMemoryLocalStorage()
        localStorage.setItem("hashtagSuggestEnabled", "false")
        vi.stubGlobal("window", { localStorage })
        expect(readHashtagSuggestEnabledSetting(true)).toBe(false)
    })
})

describe("writeHashtagSuggestEnabledSetting", () => {
    it("window が未定義でも例外を投げない", () => {
        expect(() => writeHashtagSuggestEnabledSetting(false)).not.toThrow()
    })

    it("保存した値をreadHashtagSuggestEnabledSettingで読み取れる", () => {
        const localStorage = createMemoryLocalStorage()
        vi.stubGlobal("window", { localStorage })
        writeHashtagSuggestEnabledSetting(false)
        expect(readHashtagSuggestEnabledSetting(true)).toBe(false)
    })
})

describe("readMentionSuggestEnabledSetting", () => {
    it("window が未定義の場合はdefaultValueを返す", () => {
        expect(readMentionSuggestEnabledSetting(true)).toBe(true)
    })

    it("未設定時はdefaultValueを返す", () => {
        vi.stubGlobal("window", { localStorage: createMemoryLocalStorage() })
        expect(readMentionSuggestEnabledSetting(true)).toBe(true)
    })

    it("保存済みの値を読み取れる", () => {
        const localStorage = createMemoryLocalStorage()
        localStorage.setItem("mentionSuggestEnabled", "false")
        vi.stubGlobal("window", { localStorage })
        expect(readMentionSuggestEnabledSetting(true)).toBe(false)
    })
})

describe("writeMentionSuggestEnabledSetting", () => {
    it("window が未定義でも例外を投げない", () => {
        expect(() => writeMentionSuggestEnabledSetting(false)).not.toThrow()
    })

    it("保存した値をreadMentionSuggestEnabledSettingで読み取れる", () => {
        const localStorage = createMemoryLocalStorage()
        vi.stubGlobal("window", { localStorage })
        writeMentionSuggestEnabledSetting(false)
        expect(readMentionSuggestEnabledSetting(true)).toBe(false)
    })
})
