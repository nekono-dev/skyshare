/**
 * Locks down the inline styles used to display cropped image previews.
 */
import { describe, expect, it } from "vitest"
import { computeCroppedImageStyle } from "@/components/composer/ThreadComposer/ImagePicker/croppedImageStyle"

const COVER_STYLE = {
    display: "block",
    width: "100%",
    height: "100%",
    objectFit: "cover",
}

describe("computeCroppedImageStyle preview styles", () => {
    it("uses centered cover styles when no crop is provided", () => {
        expect(computeCroppedImageStyle(null, 800, 400)).toEqual(COVER_STYLE)
    })

    it("uses centered cover styles when source dimensions are missing", () => {
        const crop = { x: 100, y: 50, width: 400, height: 200 }
        expect(computeCroppedImageStyle(crop)).toEqual(COVER_STYLE)
        expect(computeCroppedImageStyle(crop, 800)).toEqual(COVER_STYLE)
        expect(computeCroppedImageStyle(crop, undefined, 400)).toEqual(
            COVER_STYLE,
        )
    })

    it("returns crop position and scale as percentages", () => {
        // 範囲の幅 400・高さ 200 を、コンテナいっぱいに映すための拡大（元画像 800x400 は 200%）
        expect(
            computeCroppedImageStyle(
                { x: 100, y: 50, width: 400, height: 200 },
                800,
                400,
            ),
        ).toEqual({
            display: "block",
            position: "absolute",
            left: "-25%",
            top: "-25%",
            width: "200%",
            height: "200%",
            maxWidth: "none",
        })
    })
})
