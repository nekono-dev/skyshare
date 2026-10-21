import { describe, expect, it } from "vitest"
import { resolveGalleryLayout } from "@/lib/image/galleryLayout"
import type { SourceImage } from "@/lib/entry/entry"

const img = (w?: number, h?: number): SourceImage => ({
    url: "u",
    alt: "",
    cid: "c",
    ...(w && h ? { aspectRatio: { width: w, height: h } } : {}),
})
const many = (n: number) => Array.from({ length: n }, () => img())

describe("resolveGalleryLayout", () => {
    it("0枚は null", () => {
        expect(resolveGalleryLayout([])).toBeNull()
    })

    it("1枚は縦横比をそのまま使う", () => {
        expect(resolveGalleryLayout([img(4, 3)])).toEqual({
            kind: "grid",
            count: 1,
            singleRatio: 4 / 3,
        })
    })

    it("[image-gallery/AC-1] 1枚で極端な縦長は下限、横長は上限にクランプされる", () => {
        expect(resolveGalleryLayout([img(1, 10)])).toEqual({
            kind: "grid",
            count: 1,
            singleRatio: 0.75,
        })
        expect(resolveGalleryLayout([img(10, 1)])).toEqual({
            kind: "grid",
            count: 1,
            singleRatio: 2,
        })
    })

    it("[image-gallery/AC-1] 1枚で縦横比不明は 3:2", () => {
        expect(resolveGalleryLayout([img()])).toEqual({
            kind: "grid",
            count: 1,
            singleRatio: 1.5,
        })
    })

    it.each([2, 3, 4])("%i枚は grid", n => {
        expect(resolveGalleryLayout(many(n))).toEqual({
            kind: "grid",
            count: n,
        })
    })

    it.each([5, 10])("%i枚は strip", n => {
        expect(resolveGalleryLayout(many(n))).toEqual({ kind: "strip" })
    })
})
