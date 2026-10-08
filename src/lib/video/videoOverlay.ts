/**
 * 動画投稿の visual（entry の代表画像）に重ねる、再生ボタンの描画。
 *
 * X の動画表示を模した見た目で、色・透明度・寸法は X の実際の表示から実測した値
 * （単位は CSS px。`specs/entry-visual`）を `VIDEO_OVERLAY_SPEC` に固定する。
 * UI（`VideoPlayButton`）も同じ定数を参照する。
 * 再生時間は画像へ埋め込まず、entry の heading に記載する（`@/lib/entry/entryText`）。
 */
import { TARGET_HEIGHT, TARGET_WIDTH } from "@/lib/image/postImageProcessing"

export const VIDEO_OVERLAY_SPEC = {
    buttonDiameter: 59,
    buttonFill: "rgba(50, 50, 50, 0.6)",
    triangleWidth: 20,
    triangleHeight: 25,
    triangleFill: "#ffffff",
    triangleOffsetX: 2.5,
    /** CSS px → visual のデバイスピクセルへの換算基準幅（X のカード上の表示幅） */
    referenceCardWidth: 506,
} as const

/**
 * `composeThumbnailBlob` の描画後に呼ばれる、再生ボタンのオーバーレイ描画関数を返す。
 *
 * `scale` は composeThumbnailBlob が渡す「出力長辺 / 1200」で、通常は 1。
 * 寸法には `S = 1200 / referenceCardWidth` を掛けて、X 上での見た目を実測値に合わせる。
 * 円の中心は画像（動画の表示領域）の中心に置く。
 */
export const drawVideoOverlay =
    () =>
    (context: CanvasRenderingContext2D, scale: number): void => {
        const spec = VIDEO_OVERLAY_SPEC
        const s = (TARGET_WIDTH / spec.referenceCardWidth) * scale
        const width = TARGET_WIDTH * scale
        const height = TARGET_HEIGHT * scale
        const cx = width / 2
        const cy = height / 2

        // 1. 再生ボタンの円
        context.beginPath()
        context.arc(cx, cy, (spec.buttonDiameter * s) / 2, 0, Math.PI * 2)
        context.fillStyle = spec.buttonFill
        context.fill()

        // 2. 再生記号（外接矩形の中心を円の中心から右へずらす）
        const triW = spec.triangleWidth * s
        const triH = spec.triangleHeight * s
        const x0 = cx + spec.triangleOffsetX * s - triW / 2
        const y0 = cy - triH / 2
        context.beginPath()
        context.moveTo(x0, y0)
        context.lineTo(x0, y0 + triH)
        context.lineTo(x0 + triW, y0 + triH / 2)
        context.closePath()
        context.fillStyle = spec.triangleFill
        context.fill()
    }
