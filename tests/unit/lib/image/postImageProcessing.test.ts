/**
 * Verifies image slot layouts and crop calculations.
 *
 * - Canvas based processing requires a DOM and is outside this unit test.
 */
import { describe, expect, it } from "vitest"
import {
    computeCropAroundCenter,
    computeInitialCrop,
    getSlotDefs,
    TARGET_HEIGHT,
    TARGET_WIDTH,
} from "@/lib/image/postImageProcessing"

describe("getSlotDefs assigns image slots", () => {
    it("returns one full-frame slot for zero or one image", () => {
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

    it("returns two half-width slots for two images", () => {
        expect(
            getSlotDefs(2).map(({ x, y, w, h }) => ({ x, y, w, h })),
        ).toEqual([
            { x: 0, y: 0, w: 600, h: 630 },
            { x: 600, y: 0, w: 600, h: 630 },
        ])
    })

    it("returns one left slot and two stacked right slots for three images", () => {
        expect(
            getSlotDefs(3).map(({ x, y, w, h }) => ({ x, y, w, h })),
        ).toEqual([
            { x: 0, y: 0, w: 600, h: 630 },
            { x: 600, y: 0, w: 600, h: 315 },
            { x: 600, y: 315, w: 600, h: 315 },
        ])
    })

    it("returns a four-slot grid for four or more images", () => {
        const slots = getSlotDefs(4).map(({ x, y, w, h }) => ({ x, y, w, h }))
        expect(slots).toEqual([
            { x: 0, y: 0, w: 600, h: 315 },
            { x: 600, y: 0, w: 600, h: 315 },
            { x: 0, y: 315, w: 600, h: 315 },
            { x: 600, y: 315, w: 600, h: 315 },
        ])
        expect(getSlotDefs(9)).toEqual(getSlotDefs(4))
    })

    it("uses 1200x630 as the target dimensions", () => {
        expect(TARGET_WIDTH).toBe(1200)
        expect(TARGET_HEIGHT).toBe(630)
    })
})

describe("computeInitialCrop centers the initial crop", () => {
    it("crops a landscape image horizontally around the center", () => {
        // 1920x1080（16:9）は 1200x630（約 1.905）より横が広いため、幅を残す
        expect(computeInitialCrop(1920, 1080, 1200, 630)).toEqual({
            x: 0,
            y: 36,
            width: 1920,
            height: 1008,
        })
    })
})

describe("computeCropAroundCenter crops around a requested center", () => {
    it("crops a square image vertically around the requested center", () => {
        expect(
            computeCropAroundCenter(1000, 1000, 1200, 630, 500, 500),
        ).toEqual({
            x: 0,
            y: 238,
            width: 1000,
            height: 525,
        })
    })

    it("clamps a center near the top-left to the image bounds", () => {
        expect(computeCropAroundCenter(1000, 1000, 1200, 630, 0, 0)).toEqual({
            x: 0,
            y: 0,
            width: 1000,
            height: 525,
        })
    })

    it("crops an extremely wide image around the center while preserving height", () => {
        expect(computeCropAroundCenter(2400, 600, 1200, 630)).toEqual({
            x: 629,
            y: 0,
            width: 1143,
            height: 600,
        })
    })
})
