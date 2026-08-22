import { describe, expect, it } from "vitest"

import {
    clampAutoGrowHeightPx,
    computeAutoGrowBounds,
    computeRowsFromAvailableHeight,
    resolveLineHeightPx,
} from "@/components/common/CountedTextInput/autoGrowHeight"

describe("resolveLineHeightPx", () => {
    it("px単位の値はそのまま数値化する", () => {
        expect(resolveLineHeightPx("22.4px", 16)).toBe(22.4)
    })

    it("normalの場合はfontSizeの1.2倍にフォールバックする", () => {
        expect(resolveLineHeightPx("normal", 16)).toBeCloseTo(19.2)
    })

    it("unitless値はfontSizeとの乗算で解決する", () => {
        expect(resolveLineHeightPx("1.4", 16)).toBeCloseTo(22.4)
    })
})

describe("computeAutoGrowBounds", () => {
    it("rows/maxRowsからmin/maxの高さ(px)を算出する", () => {
        expect(computeAutoGrowBounds(2, 7, 20, 8)).toEqual({
            minHeightPx: 48,
            maxHeightPx: 148,
        })
    })

    it("maxRows未指定の場合、maxHeightPxはundefinedになる", () => {
        expect(computeAutoGrowBounds(2, undefined, 20, 8)).toEqual({
            minHeightPx: 48,
            maxHeightPx: undefined,
        })
    })
})

describe("computeRowsFromAvailableHeight", () => {
    it("computeAutoGrowBoundsの逆算として、範囲内の高さからrows数を算出する", () => {
        expect(computeRowsFromAvailableHeight(148, 20, 8, 2, 7)).toBe(7)
    })

    it("算出結果がminRows未満になる場合、minRowsにクランプする", () => {
        expect(computeRowsFromAvailableHeight(30, 20, 8, 2, 6)).toBe(2)
    })

    it("算出結果がmaxRowsを超える場合、maxRowsにクランプする", () => {
        expect(computeRowsFromAvailableHeight(1000, 20, 8, 2, 6)).toBe(6)
    })
})

describe("clampAutoGrowHeightPx", () => {
    it("scrollHeightがminHeight未満の場合、minHeightに引き上げてoverflow-yはhidden", () => {
        expect(clampAutoGrowHeightPx(30, 48, 148)).toEqual({
            heightPx: 48,
            overflowY: "hidden",
        })
    })

    it("scrollHeightがmin/maxの範囲内の場合、そのままの高さでoverflow-yはhidden", () => {
        expect(clampAutoGrowHeightPx(100, 48, 148)).toEqual({
            heightPx: 100,
            overflowY: "hidden",
        })
    })

    it("scrollHeightがmaxHeightを超える場合、maxHeightに切り詰めてoverflow-yはauto", () => {
        expect(clampAutoGrowHeightPx(200, 48, 148)).toEqual({
            heightPx: 148,
            overflowY: "auto",
        })
    })

    it("maxHeightPx未指定の場合、どれだけ大きくてもクランプせずoverflow-yはhidden", () => {
        expect(clampAutoGrowHeightPx(10000, 48, undefined)).toEqual({
            heightPx: 10000,
            overflowY: "hidden",
        })
    })
})
