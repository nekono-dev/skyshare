/**
 * 保管本文から最初に表示する添付画像の番号を検証する。
 */
import { describe, expect, it } from "vitest"
import { firstImageIndex } from "@/lib/schedule/firstImageIndex"

describe("firstImageIndex", () => {
    it("画像がないときは null を返す", () => {
        expect(firstImageIndex({ posts: [{ text: "本文" }] })).toBeNull()
    })

    it("root の画像を返す", () => {
        expect(firstImageIndex({ posts: [{ images: [4, 5] }] })).toBe(4)
    })

    it("root に画像がなければ次の投稿の画像を返す", () => {
        expect(firstImageIndex({ posts: [{}, { images: [7, 8] }] })).toBe(7)
    })

    it("複数画像では配列の先頭を返す", () => {
        expect(firstImageIndex({ posts: [{ images: [2, 3] }] })).toBe(2)
    })

    it("リンクカード画像だけなら null を返す", () => {
        expect(firstImageIndex({ posts: [{ ogImage: 9 }] })).toBeNull()
    })

    it("空の images は無視する", () => {
        expect(firstImageIndex({ posts: [{ images: [] }] })).toBeNull()
    })

    it("複数の投稿に画像があるときは、root に近い投稿の先頭を返す", () => {
        expect(
            firstImageIndex({ posts: [{ images: [0, 1] }, { images: [2] }] }),
        ).toBe(0)
    })

    it("空の images の後の投稿に画像があれば、その先頭を返す", () => {
        expect(
            firstImageIndex({ posts: [{ images: [] }, { images: [3, 4] }] }),
        ).toBe(3)
    })

    it("root がリンクカード画像だけで、後続に添付画像があれば後続の先頭を返す", () => {
        expect(
            firstImageIndex({ posts: [{ ogImage: 5 }, { images: [6] }] }),
        ).toBe(6)
    })
})
