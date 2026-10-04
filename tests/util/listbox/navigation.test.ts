import { describe, expect, it } from "vitest"

import {
    findPrefixIndex,
    firstEnabledIndex,
    indexOfEnabled,
    lastEnabledIndex,
    nextEnabledIndex,
} from "@/util/listbox/navigation"

const items = [
    { value: "a", label: "Apple", disabled: true },
    { value: "b", label: "Avocado" },
    { value: "c", label: "Banana", disabled: true },
    { value: "d", label: "Apricot" },
]

describe("firstEnabledIndex / lastEnabledIndex", () => {
    it("有効項目の先頭・末尾を返す", () => {
        expect(firstEnabledIndex(items)).toBe(1)
        expect(lastEnabledIndex(items)).toBe(3)
    })

    it("全て無効なら -1", () => {
        const all = [{ disabled: true }, { disabled: true }]
        expect(firstEnabledIndex(all)).toBe(-1)
        expect(lastEnabledIndex(all)).toBe(-1)
    })
})

describe("nextEnabledIndex", () => {
    it("無効項目を飛ばして移動する", () => {
        expect(nextEnabledIndex(items, 1, 1)).toBe(3)
        expect(nextEnabledIndex(items, 3, -1)).toBe(1)
    })

    it("端では移動せず現在位置のまま（循環しない）", () => {
        expect(nextEnabledIndex(items, 3, 1)).toBe(3)
        expect(nextEnabledIndex(items, 1, -1)).toBe(1)
    })

    it("未選択からは下で先頭、上で末尾の有効項目", () => {
        expect(nextEnabledIndex(items, -1, 1)).toBe(1)
        expect(nextEnabledIndex(items, -1, -1)).toBe(3)
    })

    it("全て無効なら -1", () => {
        expect(nextEnabledIndex([{ disabled: true }], -1, 1)).toBe(-1)
    })
})

describe("indexOfEnabled", () => {
    it("値に対応する有効項目のindexを返す", () => {
        expect(indexOfEnabled(items, "d")).toBe(3)
    })

    it("見つからない・無効な値は先頭の有効項目", () => {
        expect(indexOfEnabled(items, "zzz")).toBe(1)
        expect(indexOfEnabled(items, "a")).toBe(1)
    })
})

describe("findPrefixIndex", () => {
    it("大文字小文字を無視して先頭一致する有効項目を探す", () => {
        expect(findPrefixIndex(items, "av", 1)).toBe(1)
        expect(findPrefixIndex(items, "AP", 1)).toBe(3)
    })

    it("無効項目は対象外", () => {
        expect(findPrefixIndex(items, "ban", 1)).toBe(-1)
    })

    it("同一文字の連打は現在位置の次から巡回する", () => {
        expect(findPrefixIndex(items, "aa", 1)).toBe(3)
        expect(findPrefixIndex(items, "aaa", 3)).toBe(1)
    })

    it("空文字・一致なしは -1", () => {
        expect(findPrefixIndex(items, "", 0)).toBe(-1)
        expect(findPrefixIndex(items, "x", 0)).toBe(-1)
    })
})
