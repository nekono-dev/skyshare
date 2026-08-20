import { describe, expect, it } from "vitest"

import {
    canUsePostImageAsIs,
    computeCropAroundCenter,
    computeInitialCrop,
    getSlotDefs,
    TARGET_HEIGHT,
    TARGET_WIDTH,
} from "@/lib/image/postImageProcessing"

describe("getSlotDefs", () => {
    it("1枚は全面スロット", () => {
        const slots = getSlotDefs(1)
        expect(slots).toHaveLength(1)
        expect(slots[0]).toMatchObject({
            x: 0,
            y: 0,
            w: TARGET_WIDTH,
            h: TARGET_HEIGHT,
        })
    })

    it("2枚は左右2分割", () => {
        const slots = getSlotDefs(2)
        expect(slots).toHaveLength(2)
        expect(slots[0].w).toBe(TARGET_WIDTH / 2)
        expect(slots[1].x).toBe(TARGET_WIDTH / 2)
    })

    it("3枚は左1列+右上下2段", () => {
        expect(getSlotDefs(3)).toHaveLength(3)
    })

    it("4枚以上は2x2グリッド", () => {
        expect(getSlotDefs(4)).toHaveLength(4)
        expect(getSlotDefs(10)).toHaveLength(4)
    })
})

describe("computeCropAroundCenter", () => {
    it("横長画像を横長ターゲットへクロップする(高さ基準)", () => {
        const result = computeCropAroundCenter(2000, 1000, 1200, 630)
        expect(result.height).toBe(1000)
        expect(result.width).toBe(Math.round((1200 / 630) * 1000))
    })

    it("縦長画像を横長ターゲットへクロップする(幅基準)", () => {
        const result = computeCropAroundCenter(1000, 2000, 1200, 630)
        expect(result.width).toBe(1000)
        expect(result.height).toBe(Math.round(1000 / (1200 / 630)))
    })

    it("中心座標が画像端に寄っていてもclampされ境界内に収まる", () => {
        const result = computeCropAroundCenter(1000, 1000, 1200, 630, 0, 0)
        expect(result.x).toBeGreaterThanOrEqual(0)
        expect(result.y).toBeGreaterThanOrEqual(0)
        expect(result.x + result.width).toBeLessThanOrEqual(1000)
        expect(result.y + result.height).toBeLessThanOrEqual(1000)
    })
})

describe("computeInitialCrop", () => {
    it("computeCropAroundCenterを中心指定なしで呼び出したものと一致する", () => {
        expect(computeInitialCrop(1920, 1080, 1200, 630)).toEqual(
            computeCropAroundCenter(1920, 1080, 1200, 630),
        )
    })
})

describe("canUsePostImageAsIs", () => {
    it("jpeg かつ 予算内なら true", () => {
        const blob = new Blob([new Uint8Array(1000)], { type: "image/jpeg" })
        expect(canUsePostImageAsIs(blob)).toBe(true)
    })

    it("png かつ 予算内なら true", () => {
        const blob = new Blob([new Uint8Array(1000)], { type: "image/png" })
        expect(canUsePostImageAsIs(blob)).toBe(true)
    })

    it("webp は false(形式が対象外)", () => {
        const blob = new Blob([new Uint8Array(1000)], { type: "image/webp" })
        expect(canUsePostImageAsIs(blob)).toBe(false)
    })

    it("予算超過のjpegは false", () => {
        const blob = new Blob([new Uint8Array(2_000_000)], {
            type: "image/jpeg",
        })
        expect(canUsePostImageAsIs(blob)).toBe(false)
    })
})
