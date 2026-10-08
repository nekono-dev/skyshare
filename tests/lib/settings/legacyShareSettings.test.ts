import { afterEach, describe, expect, it, vi } from "vitest"

import {
    deriveAutoPopupTarget,
    migrateLegacyShareSettings,
} from "@/lib/settings/legacyShareSettings"

/**
 * テスト用の最小限の localStorage 実装（メモリ上に値を保持するだけ）。
 *
 * Input:
 * - `options.failOnSet`: true の場合、setItem が例外を投げる
 */
const createMemoryLocalStorage = (options: { failOnSet?: boolean } = {}) => {
    const store = new Map<string, string>()
    return {
        store,
        getItem: (key: string) => store.get(key) ?? null,
        setItem: (key: string, value: string) => {
            if (options.failOnSet) {
                throw new Error("QuotaExceededError")
            }
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

describe("deriveAutoPopupTarget", () => {
    const base = {
        crosspostToTaittsuu: false,
        crosspostToMastodon: false,
        showCrosspostXButton: false,
    }

    it.each([
        ["すべてOFF → x", base, "x"],
        [
            "タイッツーのみON → taittsuu",
            { ...base, crosspostToTaittsuu: true },
            "taittsuu",
        ],
        [
            "Mastodonのみ ON → mastodon",
            { ...base, crosspostToMastodon: true },
            "mastodon",
        ],
        ["X投稿ボタンのみON → x", { ...base, showCrosspostXButton: true }, "x"],
        [
            "タイッツーとMastodonがON → ask",
            { ...base, crosspostToTaittsuu: true, crosspostToMastodon: true },
            "ask",
        ],
        [
            "タイッツーとX投稿ボタンがON → ask",
            { ...base, crosspostToTaittsuu: true, showCrosspostXButton: true },
            "ask",
        ],
        [
            "MastodonとX投稿ボタンがON → ask",
            { ...base, crosspostToMastodon: true, showCrosspostXButton: true },
            "ask",
        ],
        [
            "3つともON → ask",
            {
                crosspostToTaittsuu: true,
                crosspostToMastodon: true,
                showCrosspostXButton: true,
            },
            "ask",
        ],
    ] as const)("[share-settings/AC-7] %s", (_name, legacy, expected) => {
        expect(deriveAutoPopupTarget(legacy)).toBe(expected)
    })
})

describe("migrateLegacyShareSettings", () => {
    it("window が未定義でも例外を投げない", () => {
        expect(() => migrateLegacyShareSettings()).not.toThrow()
    })

    it("旧キーがいずれも無ければ何も保存しない", () => {
        const localStorage = createMemoryLocalStorage()
        vi.stubGlobal("window", { localStorage })
        migrateLegacyShareSettings()
        expect(localStorage.store.size).toBe(0)
    })

    it("[share-settings/AC-6] 新キー未保存なら旧設定から引き継いで保存し、旧キー4つを削除する", () => {
        const localStorage = createMemoryLocalStorage()
        localStorage.setItem("crosspostToTaittsuu", "true")
        localStorage.setItem("showCrosspostXButton", "true")
        localStorage.setItem("noAutoPopupAfterPost", "false")
        localStorage.setItem("popupIntentInsteadOfWebshare", "true")
        vi.stubGlobal("window", { localStorage })

        migrateLegacyShareSettings()

        expect(localStorage.getItem("autoPopupTarget")).toBe("ask")
        expect(localStorage.getItem("crosspostToTaittsuu")).toBeNull()
        expect(localStorage.getItem("showCrosspostXButton")).toBeNull()
        expect(localStorage.getItem("noAutoPopupAfterPost")).toBeNull()
        expect(localStorage.getItem("crosspostToMastodon")).toBeNull()
        // 意味が変わらない設定は残す
        expect(localStorage.getItem("popupIntentInsteadOfWebshare")).toBe(
            "true",
        )
    })

    it("ちょうど1つだけONなら、そのSNSを引き継ぐ", () => {
        const localStorage = createMemoryLocalStorage()
        localStorage.setItem("crosspostToTaittsuu", "true")
        localStorage.setItem("crosspostToMastodon", "false")
        vi.stubGlobal("window", { localStorage })

        migrateLegacyShareSettings()

        expect(localStorage.getItem("autoPopupTarget")).toBe("taittsuu")
        expect(localStorage.getItem("crosspostToTaittsuu")).toBeNull()
    })

    it("「自動ポップアップをOFFにする」のみがONなら、既定の x を引き継ぐ", () => {
        const localStorage = createMemoryLocalStorage()
        localStorage.setItem("noAutoPopupAfterPost", "true")
        vi.stubGlobal("window", { localStorage })

        migrateLegacyShareSettings()

        expect(localStorage.getItem("autoPopupTarget")).toBe("x")
        expect(localStorage.getItem("noAutoPopupAfterPost")).toBeNull()
    })

    it("旧キーの値が true 以外ならOFFとして扱う", () => {
        const localStorage = createMemoryLocalStorage()
        localStorage.setItem("crosspostToMastodon", "yes")
        vi.stubGlobal("window", { localStorage })

        migrateLegacyShareSettings()

        expect(localStorage.getItem("autoPopupTarget")).toBe("x")
    })

    it("新キーが保存済みなら上書きせず、旧キーのみ削除する", () => {
        const localStorage = createMemoryLocalStorage()
        localStorage.setItem("autoPopupTarget", "mastodon")
        localStorage.setItem("noAutoPopupAfterPost", "true")
        vi.stubGlobal("window", { localStorage })

        migrateLegacyShareSettings()

        expect(localStorage.getItem("autoPopupTarget")).toBe("mastodon")
        expect(localStorage.getItem("noAutoPopupAfterPost")).toBeNull()
    })

    it("保存に失敗した場合は旧キーを残す", () => {
        const localStorage = createMemoryLocalStorage({ failOnSet: true })
        localStorage.store.set("noAutoPopupAfterPost", "true")
        vi.stubGlobal("window", { localStorage })

        expect(() => migrateLegacyShareSettings()).not.toThrow()
        expect(localStorage.store.get("noAutoPopupAfterPost")).toBe("true")
        expect(localStorage.store.has("autoPopupTarget")).toBe(false)
    })

    it("2回目以降は旧キーが無いため何もしない（冪等）", () => {
        const localStorage = createMemoryLocalStorage()
        localStorage.setItem("noAutoPopupAfterPost", "true")
        vi.stubGlobal("window", { localStorage })

        migrateLegacyShareSettings()
        localStorage.setItem("autoPopupTarget", "x")
        migrateLegacyShareSettings()

        expect(localStorage.getItem("autoPopupTarget")).toBe("x")
    })
})
