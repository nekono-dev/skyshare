import { afterEach, describe, expect, it, vi } from "vitest"

import {
    addHashtagsToHistory,
    readHashtagHistory,
    seedHashtagHistoryFromRankedTags,
} from "@/lib/settings/hashtagHistorySettings"

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

describe("readHashtagHistory", () => {
    it("window が未定義の場合は空配列を返す", () => {
        expect(readHashtagHistory()).toEqual([])
    })

    it("未設定時は空配列を返す", () => {
        vi.stubGlobal("window", { localStorage: createMemoryLocalStorage() })
        expect(readHashtagHistory()).toEqual([])
    })

    it("不正なJSONの場合は空配列にフォールバックする", () => {
        const localStorage = createMemoryLocalStorage()
        localStorage.setItem("hashtagHistory", "not json")
        vi.stubGlobal("window", { localStorage })
        expect(readHashtagHistory()).toEqual([])
    })

    it("新しい順に並べ替えて返す", () => {
        const localStorage = createMemoryLocalStorage()
        localStorage.setItem(
            "hashtagHistory",
            JSON.stringify([
                { tag: "old", lastUsedAt: 1 },
                { tag: "new", lastUsedAt: 2 },
            ]),
        )
        vi.stubGlobal("window", { localStorage })
        expect(readHashtagHistory().map(e => e.tag)).toEqual(["new", "old"])
    })
})

describe("addHashtagsToHistory", () => {
    it("window が未定義でも例外を投げない", () => {
        expect(() => addHashtagsToHistory(["猫"])).not.toThrow()
    })

    it("追加したタグをreadHashtagHistoryで読み取れる", () => {
        vi.stubGlobal("window", { localStorage: createMemoryLocalStorage() })
        addHashtagsToHistory(["猫", "bluesky"])
        expect(readHashtagHistory().map(e => e.tag)).toEqual(["猫", "bluesky"])
    })

    it("同一タグ(大文字小文字無視)は最新の表記・時刻で1件にまとめる", () => {
        vi.stubGlobal("window", { localStorage: createMemoryLocalStorage() })
        addHashtagsToHistory(["Bluesky"])
        addHashtagsToHistory(["bluesky"])
        const history = readHashtagHistory()
        expect(history).toHaveLength(1)
        expect(history[0].tag).toBe("bluesky")
    })

    it("上限50件を超えた古い履歴は切り詰められる", () => {
        vi.stubGlobal("window", { localStorage: createMemoryLocalStorage() })
        for (let i = 0; i < 55; i++) {
            addHashtagsToHistory([`tag${i}`])
        }
        const history = readHashtagHistory()
        expect(history).toHaveLength(50)
        expect(history.map(e => e.tag)).toContain("tag54")
        expect(history.map(e => e.tag)).not.toContain("tag0")
    })
})

describe("seedHashtagHistoryFromRankedTags", () => {
    it("window が未定義でも例外を投げない", () => {
        expect(() =>
            seedHashtagHistoryFromRankedTags(["猫", "犬"]),
        ).not.toThrow()
    })

    it("履歴が空の場合、渡した順（使用数順）で履歴として書き込む", () => {
        vi.stubGlobal("window", { localStorage: createMemoryLocalStorage() })
        seedHashtagHistoryFromRankedTags(["猫", "犬", "bluesky"])
        expect(readHashtagHistory().map(e => e.tag)).toEqual([
            "猫",
            "犬",
            "bluesky",
        ])
    })

    it("履歴が既にある場合は何もしない（上書きしない）", () => {
        vi.stubGlobal("window", { localStorage: createMemoryLocalStorage() })
        addHashtagsToHistory(["既存タグ"])
        seedHashtagHistoryFromRankedTags(["猫", "犬"])
        expect(readHashtagHistory().map(e => e.tag)).toEqual(["既存タグ"])
    })

    it("localStorageのキーはあっても中身が空配列なら集計結果を書き込む", () => {
        const localStorage = createMemoryLocalStorage()
        localStorage.setItem("hashtagHistory", JSON.stringify([]))
        vi.stubGlobal("window", { localStorage })
        seedHashtagHistoryFromRankedTags(["猫"])
        expect(readHashtagHistory().map(e => e.tag)).toEqual(["猫"])
    })

    it("上限50件を超える場合は先頭から切り詰める", () => {
        vi.stubGlobal("window", { localStorage: createMemoryLocalStorage() })
        const tags = Array.from({ length: 55 }, (_, i) => `tag${i}`)
        seedHashtagHistoryFromRankedTags(tags)
        const history = readHashtagHistory()
        expect(history).toHaveLength(50)
        expect(history.map(e => e.tag)).toContain("tag0")
        expect(history.map(e => e.tag)).not.toContain("tag50")
    })

    it("空配列を渡した場合は何もしない", () => {
        vi.stubGlobal("window", { localStorage: createMemoryLocalStorage() })
        seedHashtagHistoryFromRankedTags([])
        expect(readHashtagHistory()).toEqual([])
    })
})
