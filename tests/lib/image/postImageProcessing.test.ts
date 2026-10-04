import { afterEach, describe, expect, it, vi } from "vitest"

import {
    canUsePostImageAsIs,
    computeCropAroundCenter,
    computeInitialCrop,
    createDefaultThumbnail,
    createProcessedImages,
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

describe("createProcessedImages", () => {
    afterEach(() => {
        vi.unstubAllGlobals()
    })

    /** Image / canvas / fetch をスタブ化し、visual合成で実際に描画された画像srcを記録する。 */
    const stubBrowserApis = () => {
        const drawnSrcs: string[] = []
        class FakeImage {
            naturalWidth = 2000
            naturalHeight = 1000
            onload: (() => void) | null = null
            onerror: (() => void) | null = null
            private currentSrc = ""
            set src(value: string) {
                this.currentSrc = value
                queueMicrotask(() => this.onload?.())
            }
            get src() {
                return this.currentSrc
            }
        }
        vi.stubGlobal("Image", FakeImage)
        vi.stubGlobal("document", {
            createElement: () => ({
                width: 0,
                height: 0,
                getContext: () => ({
                    drawImage: (image: FakeImage, ...args: number[]) => {
                        // 合成サムネイルへの描画（9引数形式）のみ記録する
                        if (args.length === 8) drawnSrcs.push(image.src)
                    },
                }),
                toBlob: (cb: (blob: Blob) => void, type: string) =>
                    cb(new Blob(["x"], { type })),
            }),
        })
        vi.stubGlobal(
            "fetch",
            vi.fn(async () => ({
                blob: async () => new Blob(["src"], { type: "image/jpeg" }),
            })),
        )
        return drawnSrcs
    }

    const buildCropStates = (count: number) =>
        Array.from({ length: count }, () => ({
            crop: { x: 0, y: 0 },
            zoom: 1,
            cropPixels: { x: 0, y: 0, width: 100, height: 50 },
        }))

    it("5枚入力でoriginalBlobsは5件、visualの素材は先頭4枚のみ", async () => {
        const drawnSrcs = stubBrowserApis()
        const urls = ["u0", "u1", "u2", "u3", "u4"]
        const result = await createProcessedImages(urls, buildCropStates(5))
        expect(result.originalBlobs).toHaveLength(5)
        expect(result.thumbnailBlob).toBeInstanceOf(Blob)
        expect(drawnSrcs).toEqual(["u0", "u1", "u2", "u3"])
    })

    it("5枚目以降のcropStateが無くても合成できる", async () => {
        stubBrowserApis()
        const urls = Array.from({ length: 10 }, (_, i) => `u${i}`)
        const result = await createProcessedImages(urls, buildCropStates(4))
        expect(result.originalBlobs).toHaveLength(10)
    })
})

describe("createDefaultThumbnail の overlay", () => {
    afterEach(() => {
        vi.unstubAllGlobals()
    })

    const stubCanvas = () => {
        const context = { drawImage: vi.fn() }
        class FakeImage {
            naturalWidth = 2000
            naturalHeight = 1000
            onload: (() => void) | null = null
            onerror: (() => void) | null = null
            set src(_value: string) {
                queueMicrotask(() => this.onload?.())
            }
        }
        vi.stubGlobal("Image", FakeImage)
        vi.stubGlobal("document", {
            createElement: () => ({
                width: 0,
                height: 0,
                getContext: () => context,
                toBlob: (cb: (blob: Blob) => void, type: string) =>
                    cb(new Blob(["x"], { type })),
            }),
        })
        return context
    }

    it("overlay を渡すと描画のたびに context と scale 付きで呼ばれる", async () => {
        const context = stubCanvas()
        const overlay = vi.fn()
        await createDefaultThumbnail(["u0"], overlay)
        expect(overlay).toHaveBeenCalled()
        expect(overlay.mock.calls[0][0]).toBe(context)
        expect(overlay.mock.calls[0][1]).toBe(1)
    })

    it("overlay を渡さなければ従来どおり合成できる", async () => {
        stubCanvas()
        const blob = await createDefaultThumbnail(["u0"])
        expect(blob).toBeInstanceOf(Blob)
    })
})
