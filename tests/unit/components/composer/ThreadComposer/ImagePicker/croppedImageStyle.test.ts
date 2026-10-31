// プレビューのインラインスタイルの値を固定する（要件 2.2）。
import { describe, expect, it } from "vitest"
import { computeCroppedImageStyle } from "@/components/composer/ThreadComposer/ImagePicker/croppedImageStyle"

const COVER_STYLE = {
    display: "block",
    width: "100%",
    height: "100%",
    objectFit: "cover",
}

describe("computeCroppedImageStyle（プレビューのインラインスタイル）", () => {
    it("クロップ範囲が無い場合は、中央基準のカバー表示を返す", () => {
        expect(computeCroppedImageStyle(null, 800, 400)).toEqual(COVER_STYLE)
    })

    it("元画像の寸法が無い場合は、中央基準のカバー表示を返す", () => {
        const crop = { x: 100, y: 50, width: 400, height: 200 }
        expect(computeCroppedImageStyle(crop)).toEqual(COVER_STYLE)
        expect(computeCroppedImageStyle(crop, 800)).toEqual(COVER_STYLE)
        expect(computeCroppedImageStyle(crop, undefined, 400)).toEqual(
            COVER_STYLE,
        )
    })

    it("クロップ範囲がある場合は、位置・大きさ・拡大率を百分率で返す", () => {
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
