import { afterEach, describe, expect, it, vi } from "vitest"

import {
    isAutoPopupTarget,
    readAutoPopupTargetSetting,
    resolveMastodonInstanceDomain,
    writeAutoPopupTargetSetting,
} from "@/lib/settings/shareSettings"

/** テスト用の最小限の localStorage 実装（メモリ上に値を保持するだけ）。 */
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

describe("isAutoPopupTarget", () => {
    it.each(["ask", "x", "taittsuu", "mastodon"])("%s は妥当", value => {
        expect(isAutoPopupTarget(value)).toBe(true)
    })

    it.each(["", "X", "bluesky", null, undefined, 1])("%s は不正", value => {
        expect(isAutoPopupTarget(value)).toBe(false)
    })
})

describe("readAutoPopupTargetSetting / writeAutoPopupTargetSetting", () => {
    it("window が未定義の場合は defaultValue を返す", () => {
        expect(readAutoPopupTargetSetting("x")).toBe("x")
    })

    it("[share-settings/AC-2] 未設定時は defaultValue を返す", () => {
        vi.stubGlobal("window", { localStorage: createMemoryLocalStorage() })
        expect(readAutoPopupTargetSetting("x")).toBe("x")
    })

    it("[share-settings/AC-1] 保存した値を読み取れる", () => {
        vi.stubGlobal("window", { localStorage: createMemoryLocalStorage() })
        writeAutoPopupTargetSetting("ask")
        expect(readAutoPopupTargetSetting("x")).toBe("ask")
    })

    it("不正な値が保存されている場合は defaultValue にフォールバックする", () => {
        const localStorage = createMemoryLocalStorage()
        localStorage.setItem("autoPopupTarget", "bluesky")
        vi.stubGlobal("window", { localStorage })
        expect(readAutoPopupTargetSetting("x")).toBe("x")
    })

    it("[share-settings/AC-6] 旧設定のみが保存されている場合は引き継いだ値を返し、旧キーを削除する", () => {
        const localStorage = createMemoryLocalStorage()
        localStorage.setItem("crosspostToMastodon", "true")
        localStorage.setItem("showCrosspostXButton", "true")
        vi.stubGlobal("window", { localStorage })

        expect(readAutoPopupTargetSetting("x")).toBe("ask")
        expect(localStorage.getItem("crosspostToMastodon")).toBeNull()
        expect(localStorage.getItem("autoPopupTarget")).toBe("ask")
    })

    it("[share-settings/AC-9] localStorage が例外を投げる環境では defaultValue を返し、書き込みも例外を投げない", () => {
        vi.stubGlobal("window", {
            localStorage: {
                getItem: () => {
                    throw new Error("denied")
                },
                setItem: () => {
                    throw new Error("denied")
                },
                removeItem: () => {
                    throw new Error("denied")
                },
            },
        })
        expect(readAutoPopupTargetSetting("taittsuu")).toBe("taittsuu")
        expect(() => writeAutoPopupTargetSetting("ask")).not.toThrow()
    })
})

describe("resolveMastodonInstanceDomain", () => {
    it.each([
        ["", "mastodon.social"],
        ["   ", "mastodon.social"],
        ["example.com", "example.com"],
        ["  example.com  ", "example.com"],
        ["https://example.com/", null],
        ["example", null],
        ["exa mple.com", null],
    ] as const)("%j → %j", (input, expected) => {
        expect(resolveMastodonInstanceDomain(input)).toBe(expected)
    })
})
