import { afterEach, describe, expect, it, vi } from "vitest"

import {
    LOCALE_SETTING_KEY,
    readLocaleSetting,
    writeLocaleSetting,
} from "@/lib/i18n/localeSetting"

const stubWindow = (storage: Record<string, unknown>) => {
    vi.stubGlobal("window", { localStorage: storage })
}

afterEach(() => {
    vi.unstubAllGlobals()
})

describe("localeSetting", () => {
    it("window が無ければ system", () => {
        expect(readLocaleSetting()).toBe("system")
    })
    it("保存値が有効ならその値、不正値は system", () => {
        stubWindow({ getItem: () => "en" })
        expect(readLocaleSetting()).toBe("en")
        stubWindow({ getItem: () => "fr" })
        expect(readLocaleSetting()).toBe("system")
        stubWindow({ getItem: () => null })
        expect(readLocaleSetting()).toBe("system")
    })
    it("読み取りで例外が出ても system", () => {
        stubWindow({
            getItem: () => {
                throw new Error("blocked")
            },
        })
        expect(readLocaleSetting()).toBe("system")
    })
    it("[i18n-locale/AC-4] system はキー削除、それ以外は保存", () => {
        const setItem = vi.fn()
        const removeItem = vi.fn()
        stubWindow({ setItem, removeItem })
        writeLocaleSetting("en")
        expect(setItem).toHaveBeenCalledWith(LOCALE_SETTING_KEY, "en")
        writeLocaleSetting("system")
        expect(removeItem).toHaveBeenCalledWith(LOCALE_SETTING_KEY)
    })
    it("書き込みで例外が出ても投げない", () => {
        stubWindow({
            setItem: () => {
                throw new Error("quota")
            },
        })
        expect(() => writeLocaleSetting("ja")).not.toThrow()
    })
})
