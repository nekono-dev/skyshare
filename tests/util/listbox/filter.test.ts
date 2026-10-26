import { describe, expect, it } from "vitest"

import { filterOptions, normalizeForSearch } from "@/util/listbox/filter"

const items = [
    { label: "日本語", searchText: "ja" },
    { label: "한국어", searchText: "ko" },
    { label: "English", searchText: "en" },
]

describe("normalizeForSearch", () => {
    it("[dropdown-search/2.1] 全角半角と大文字小文字を同一視する", () => {
        expect(normalizeForSearch("ＫＯ")).toBe("ko")
        expect(normalizeForSearch("English")).toBe("english")
    })
})

describe("filterOptions", () => {
    it("空クエリ（空白のみ含む）は全件", () => {
        expect(filterOptions(items, "")).toHaveLength(3)
        expect(filterOptions(items, "  ")).toHaveLength(3)
    })

    it("[dropdown-search/2.1] ラベルの部分一致で絞り込む", () => {
        expect(filterOptions(items, "한국")).toEqual([items[1]])
        expect(filterOptions(items, "ENGL")).toEqual([items[2]])
    })

    it("[dropdown-search/2.2] searchText でも絞り込める（全角入力も可）", () => {
        expect(filterOptions(items, "ko")).toEqual([items[1]])
        expect(filterOptions(items, "ＪＡ")).toEqual([items[0]])
    })

    it("一致なしは空配列", () => {
        expect(filterOptions(items, "zzz")).toEqual([])
    })
})

describe("filterOptions の処理時間", () => {
    it("[dropdown-search/2.5] 約180件の選択肢の絞り込みが、16ミリ秒以内に終わる", () => {
        const many = Array.from({ length: 180 }, (_, i) => ({
            label: `言語${i} Language ${i}`,
            searchText: `lang${i} ＬＡＮＧ${i}`,
        }))
        // 初回のJIT等の影響を除くため、ウォームアップの後に複数回測り、最小値で判定する
        filterOptions(many, "ko")
        const durations = Array.from({ length: 20 }, () => {
            const start = performance.now()
            filterOptions(many, "ｌａｎｇ１")
            return performance.now() - start
        })
        expect(Math.min(...durations)).toBeLessThanOrEqual(16)
    })
})
