import { afterEach, describe, expect, it, vi } from "vitest"

import {
    addHashtagsToHistory,
    getHashtagHistoryMax,
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

const DID = "did:plc:test"
const STORAGE_KEY = `hashtagHistory:${DID}`

afterEach(() => {
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
})

describe("getHashtagHistoryMax", () => {
    it("環境変数が未設定の場合は既定値(100)を返す", () => {
        expect(getHashtagHistoryMax()).toBe(100)
    })

    it("環境変数に正の整数が設定されていればその値を返す", () => {
        vi.stubEnv("PUBLIC_HASHTAG_HISTORY_MAX", "5")
        expect(getHashtagHistoryMax()).toBe(5)
    })

    it("環境変数が不正値(0以下・非数値)の場合は既定値にフォールバックする", () => {
        vi.stubEnv("PUBLIC_HASHTAG_HISTORY_MAX", "0")
        expect(getHashtagHistoryMax()).toBe(100)

        vi.stubEnv("PUBLIC_HASHTAG_HISTORY_MAX", "not-a-number")
        expect(getHashtagHistoryMax()).toBe(100)
    })
})

describe("readHashtagHistory", () => {
    it("window が未定義の場合は空配列を返す", () => {
        expect(readHashtagHistory(DID)).toEqual([])
    })

    it("accountDidが未解決の場合は空配列を返す", () => {
        vi.stubGlobal("window", { localStorage: createMemoryLocalStorage() })
        expect(readHashtagHistory(null)).toEqual([])
        expect(readHashtagHistory(undefined)).toEqual([])
    })

    it("未設定時は空配列を返す", () => {
        vi.stubGlobal("window", { localStorage: createMemoryLocalStorage() })
        expect(readHashtagHistory(DID)).toEqual([])
    })

    it("不正なJSONの場合は空配列にフォールバックする", () => {
        const localStorage = createMemoryLocalStorage()
        localStorage.setItem(STORAGE_KEY, "not json")
        vi.stubGlobal("window", { localStorage })
        expect(readHashtagHistory(DID)).toEqual([])
    })

    it("新しい順に並べ替えて返す", () => {
        const localStorage = createMemoryLocalStorage()
        localStorage.setItem(
            STORAGE_KEY,
            JSON.stringify([
                { tag: "old", lastUsedAt: 1 },
                { tag: "new", lastUsedAt: 2 },
            ]),
        )
        vi.stubGlobal("window", { localStorage })
        expect(readHashtagHistory(DID).map(e => e.tag)).toEqual(["new", "old"])
    })

    it("別アカウントの履歴は混ざらない", () => {
        const localStorage = createMemoryLocalStorage()
        vi.stubGlobal("window", { localStorage })
        addHashtagsToHistory(["猫"], "did:plc:alice")
        addHashtagsToHistory(["犬"], "did:plc:bob")
        expect(readHashtagHistory("did:plc:alice").map(e => e.tag)).toEqual([
            "猫",
        ])
        expect(readHashtagHistory("did:plc:bob").map(e => e.tag)).toEqual([
            "犬",
        ])
    })
})

describe("addHashtagsToHistory", () => {
    it("window が未定義でも例外を投げない", () => {
        expect(() => addHashtagsToHistory(["猫"], DID)).not.toThrow()
    })

    it("accountDidが未解決の場合は何もしない", () => {
        vi.stubGlobal("window", { localStorage: createMemoryLocalStorage() })
        expect(() => addHashtagsToHistory(["猫"], null)).not.toThrow()
        expect(readHashtagHistory(DID)).toEqual([])
    })

    it("追加したタグをreadHashtagHistoryで読み取れる", () => {
        vi.stubGlobal("window", { localStorage: createMemoryLocalStorage() })
        addHashtagsToHistory(["猫", "bluesky"], DID)
        expect(readHashtagHistory(DID).map(e => e.tag)).toEqual([
            "猫",
            "bluesky",
        ])
    })

    it("同一タグ(大文字小文字無視)は最新の表記・時刻で1件にまとめる", () => {
        vi.stubGlobal("window", { localStorage: createMemoryLocalStorage() })
        addHashtagsToHistory(["Bluesky"], DID)
        addHashtagsToHistory(["bluesky"], DID)
        const history = readHashtagHistory(DID)
        expect(history).toHaveLength(1)
        expect(history[0].tag).toBe("bluesky")
    })

    it("上限件数を超えた古い履歴は切り詰められる", () => {
        vi.stubGlobal("window", { localStorage: createMemoryLocalStorage() })
        vi.stubEnv("PUBLIC_HASHTAG_HISTORY_MAX", "5")
        for (let i = 0; i < 10; i++) {
            addHashtagsToHistory([`tag${i}`], DID)
        }
        const history = readHashtagHistory(DID)
        expect(history).toHaveLength(getHashtagHistoryMax())
        expect(history.map(e => e.tag)).toContain("tag9")
        expect(history.map(e => e.tag)).not.toContain("tag0")
    })
})

describe("seedHashtagHistoryFromRankedTags", () => {
    it("window が未定義でも例外を投げない", () => {
        expect(() =>
            seedHashtagHistoryFromRankedTags(["猫", "犬"], DID),
        ).not.toThrow()
    })

    it("accountDidが未解決の場合は何もしない", () => {
        vi.stubGlobal("window", { localStorage: createMemoryLocalStorage() })
        expect(() =>
            seedHashtagHistoryFromRankedTags(["猫", "犬"], null),
        ).not.toThrow()
        expect(readHashtagHistory(DID)).toEqual([])
    })

    it("履歴が空の場合、渡した順（使用数順）で履歴として書き込む", () => {
        vi.stubGlobal("window", { localStorage: createMemoryLocalStorage() })
        seedHashtagHistoryFromRankedTags(["猫", "犬", "bluesky"], DID)
        expect(readHashtagHistory(DID).map(e => e.tag)).toEqual([
            "猫",
            "犬",
            "bluesky",
        ])
    })

    it("履歴が既にある場合は何もしない（上書きしない）", () => {
        vi.stubGlobal("window", { localStorage: createMemoryLocalStorage() })
        addHashtagsToHistory(["既存タグ"], DID)
        seedHashtagHistoryFromRankedTags(["猫", "犬"], DID)
        expect(readHashtagHistory(DID).map(e => e.tag)).toEqual(["既存タグ"])
    })

    it("localStorageのキーはあっても中身が空配列なら集計結果を書き込む", () => {
        const localStorage = createMemoryLocalStorage()
        localStorage.setItem(STORAGE_KEY, JSON.stringify([]))
        vi.stubGlobal("window", { localStorage })
        seedHashtagHistoryFromRankedTags(["猫"], DID)
        expect(readHashtagHistory(DID).map(e => e.tag)).toEqual(["猫"])
    })

    it("上限件数を超える場合は先頭から切り詰める", () => {
        vi.stubGlobal("window", { localStorage: createMemoryLocalStorage() })
        vi.stubEnv("PUBLIC_HASHTAG_HISTORY_MAX", "5")
        const tags = Array.from({ length: 10 }, (_, i) => `tag${i}`)
        seedHashtagHistoryFromRankedTags(tags, DID)
        const history = readHashtagHistory(DID)
        expect(history).toHaveLength(getHashtagHistoryMax())
        expect(history.map(e => e.tag)).toContain("tag0")
        expect(history.map(e => e.tag)).not.toContain("tag5")
    })

    it("空配列を渡した場合は何もしない", () => {
        vi.stubGlobal("window", { localStorage: createMemoryLocalStorage() })
        seedHashtagHistoryFromRankedTags([], DID)
        expect(readHashtagHistory(DID)).toEqual([])
    })
})
