import { afterEach, describe, expect, it, vi } from "vitest"

import {
    applyThemeMode,
    readThemeModeSetting,
    writeThemeModeSetting,
} from "@/lib/settings/themeSettings"

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

describe("readThemeModeSetting", () => {
    it("window が未定義の場合はdefaultValueを返す", () => {
        expect(readThemeModeSetting("system")).toBe("system")
    })

    it("未設定時はdefaultValueを返す", () => {
        vi.stubGlobal("window", { localStorage: createMemoryLocalStorage() })
        expect(readThemeModeSetting("system")).toBe("system")
    })

    it("保存済みの値を読み取れる", () => {
        const localStorage = createMemoryLocalStorage()
        localStorage.setItem("themeMode", "dark")
        vi.stubGlobal("window", { localStorage })
        expect(readThemeModeSetting("system")).toBe("dark")
    })

    it("不正な値が保存されている場合はdefaultValueにフォールバックする", () => {
        const localStorage = createMemoryLocalStorage()
        localStorage.setItem("themeMode", "sepia")
        vi.stubGlobal("window", { localStorage })
        expect(readThemeModeSetting("system")).toBe("system")
    })
})

describe("writeThemeModeSetting", () => {
    it("window が未定義でも例外を投げない", () => {
        expect(() => writeThemeModeSetting("dark")).not.toThrow()
    })

    it("保存した値をreadThemeModeSettingで読み取れる", () => {
        const localStorage = createMemoryLocalStorage()
        vi.stubGlobal("window", { localStorage })
        writeThemeModeSetting("dark")
        expect(readThemeModeSetting("system")).toBe("dark")
    })
})

describe("applyThemeMode", () => {
    it("document が未定義でも例外を投げない", () => {
        expect(() => applyThemeMode("dark")).not.toThrow()
    })

    it("light/darkの場合はdata-theme属性を設定する", () => {
        const documentElement = { dataset: {} as Record<string, string> }
        vi.stubGlobal("document", { documentElement })
        applyThemeMode("dark")
        expect(documentElement.dataset.theme).toBe("dark")
    })

    it("systemの場合はdata-theme属性を削除する", () => {
        const removeAttribute = vi.fn()
        vi.stubGlobal("document", {
            documentElement: { dataset: { theme: "dark" }, removeAttribute },
        })
        applyThemeMode("system")
        expect(removeAttribute).toHaveBeenCalledWith("data-theme")
    })
})
