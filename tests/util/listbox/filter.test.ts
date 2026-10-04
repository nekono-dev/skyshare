import { describe, expect, it } from "vitest"

import { filterOptions, normalizeForSearch } from "@/util/listbox/filter"

const items = [
    { label: "日本語", searchText: "ja" },
    { label: "한국어", searchText: "ko" },
    { label: "English", searchText: "en" },
]

describe("normalizeForSearch", () => {
    it("全角半角と大文字小文字を同一視する", () => {
        expect(normalizeForSearch("ＫＯ")).toBe("ko")
        expect(normalizeForSearch("English")).toBe("english")
    })
})

describe("filterOptions", () => {
    it("空クエリ（空白のみ含む）は全件", () => {
        expect(filterOptions(items, "")).toHaveLength(3)
        expect(filterOptions(items, "  ")).toHaveLength(3)
    })

    it("ラベルの部分一致で絞り込む", () => {
        expect(filterOptions(items, "한국")).toEqual([items[1]])
        expect(filterOptions(items, "ENGL")).toEqual([items[2]])
    })

    it("searchText でも絞り込める（全角入力も可）", () => {
        expect(filterOptions(items, "ko")).toEqual([items[1]])
        expect(filterOptions(items, "ＪＡ")).toEqual([items[0]])
    })

    it("一致なしは空配列", () => {
        expect(filterOptions(items, "zzz")).toEqual([])
    })
})
