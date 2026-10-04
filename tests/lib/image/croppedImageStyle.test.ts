import { describe, expect, it } from "vitest"

import { computeCroppedImageStyle } from "@/lib/image/croppedImageStyle"

describe("computeCroppedImageStyle", () => {
    it("クロップ範囲が未確定なら中央基準のカバー表示にフォールバックする", () => {
        expect(computeCroppedImageStyle(null, 100, 100)).toMatchObject({
            width: "100%",
            height: "100%",
            objectFit: "cover",
        })
        expect(
            computeCroppedImageStyle({ x: 0, y: 0, width: 10, height: 10 }),
        ).toMatchObject({ objectFit: "cover" })
    })

    it("クロップ範囲がコンテナいっぱいに映るよう、拡大率と位置を算出する", () => {
        // 2000x1000 の画像の左上 1000x500 を表示 → 2倍に拡大し原点に合わせる
        const style = computeCroppedImageStyle(
            { x: 0, y: 0, width: 1000, height: 500 },
            2000,
            1000,
        )
        expect(style).toMatchObject({
            position: "absolute",
            left: "0%",
            top: "0%",
            width: "200%",
            height: "200%",
        })
        // 右へ 500px ずらすとコンテナ幅の 50% 分だけ左へずれる
        expect(
            computeCroppedImageStyle(
                { x: 500, y: 0, width: 1000, height: 500 },
                2000,
                1000,
            ).left,
        ).toBe("-50%")
    })
})
