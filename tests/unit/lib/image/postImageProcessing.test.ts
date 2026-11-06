// 画像の切り抜きと加工の純粋な計算を、移動と型の変更の前の値で固定する（要件 2.2・2.3）。
// canvas を使う処理（createProcessedImages など）は対象外（DOM の実行環境が必要）。
import { describe, expect, it } from "vitest"
import {
    computeCropAroundCenter,
    computeInitialCrop,
    getSlotDefs,
    TARGET_HEIGHT,
    TARGET_WIDTH,
} from "@/lib/image/postImageProcessing"

describe("getSlotDefs（枠の割り当て）", () => {
    it("1 枚と 0 枚は、全面の 1 枠を返す", () => {
        const expected = [
            {
                x: 0,
                y: 0,
                w: 1200,
                h: 630,
                aspect: 1200 / 630,
            },
        ]
        expect(getSlotDefs(1)).toEqual(expected)
        expect(getSlotDefs(0)).toEqual(expected)
    })

    it("2 枚は左右の半分の 2 枠を返す", () => {
        expect(
            getSlotDefs(2).map(({ x, y, w, h }) => ({ x, y, w, h })),
        ).toEqual([
            { x: 0, y: 0, w: 600, h: 630 },
            { x: 600, y: 0, w: 600, h: 630 },
        ])
    })

    it("3 枚は左 1 枠と右上下の 2 枠を返す", () => {
        expect(
            getSlotDefs(3).map(({ x, y, w, h }) => ({ x, y, w, h })),
        ).toEqual([
            { x: 0, y: 0, w: 600, h: 630 },
            { x: 600, y: 0, w: 600, h: 315 },
            { x: 600, y: 315, w: 600, h: 315 },
        ])
    })

    it("4 枚以上は 2 行 2 列の 4 枠を返す", () => {
        const slots = getSlotDefs(4).map(({ x, y, w, h }) => ({ x, y, w, h }))
        expect(slots).toEqual([
            { x: 0, y: 0, w: 600, h: 315 },
            { x: 600, y: 0, w: 600, h: 315 },
            { x: 0, y: 315, w: 600, h: 315 },
            { x: 600, y: 315, w: 600, h: 315 },
        ])
        expect(getSlotDefs(9)).toEqual(getSlotDefs(4))
    })

    it("目標の寸法は 1200x630 である", () => {
        expect(TARGET_WIDTH).toBe(1200)
        expect(TARGET_HEIGHT).toBe(630)
    })
})

describe("computeInitialCrop（中央基準の初期クロップ）", () => {
    it("横長の原本は、高さを残して左右を中央で切り出す", () => {
        // 1920x1080（16:9）は 1200x630（約 1.905）より横が広いため、幅を残す
        expect(computeInitialCrop(1920, 1080, 1200, 630)).toEqual({
            x: 0,
            y: 36,
            width: 1920,
            height: 1008,
        })
    })
})

describe("computeCropAroundCenter（指定中心の切り出し）", () => {
    it("正方形の原本は、幅を残して上下を指定の中心で切り出す", () => {
        expect(
            computeCropAroundCenter(1000, 1000, 1200, 630, 500, 500),
        ).toEqual({
            x: 0,
            y: 238,
            width: 1000,
            height: 525,
        })
    })

    it("中心が左上に寄っていても、画像の内側へ clamp する", () => {
        expect(computeCropAroundCenter(1000, 1000, 1200, 630, 0, 0)).toEqual({
            x: 0,
            y: 0,
            width: 1000,
            height: 525,
        })
    })

    it("極端に横長の原本は、高さを残して中央の幅で切り出す", () => {
        expect(computeCropAroundCenter(2400, 600, 1200, 630)).toEqual({
            x: 629,
            y: 0,
            width: 1143,
            height: 600,
        })
    })
})
