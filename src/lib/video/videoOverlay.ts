/**
 * 動画投稿の visual（entry の代表画像）に重ねる、再生ボタンと再生時間バッジの描画。
 *
 * X の動画表示を模した見た目で、色・透明度・寸法は X の実際の表示から実測した値
 * （単位は CSS px。`specs/video/design.md §6.5.1`）を `VIDEO_OVERLAY_SPEC` に固定する。
 * UI（`VideoPlayButton`）も同じ定数を参照する。
 */
import { TARGET_HEIGHT, TARGET_WIDTH } from "@/lib/image/postImageProcessing"

export const VIDEO_OVERLAY_SPEC = {
    buttonDiameter: 59,
    buttonFill: "rgba(50, 50, 50, 0.6)",
    triangleWidth: 20,
    triangleHeight: 25,
    triangleFill: "#ffffff",
    triangleOffsetX: 2.5,
    badgeHeight: 20,
    badgePaddingX: 9,
    badgeRadius: 4,
    badgeFill: "rgba(0, 0, 0, 0.8)",
    badgeTextColor: "#ffffff",
    badgeFontSize: 13,
    badgeFontWeight: 700,
    badgeMarginLeft: 12,
    badgeMarginBottom: 12,
    /** CSS px → visual のデバイスピクセルへの換算基準幅（X のカード上の表示幅） */
    referenceCardWidth: 506,
} as const

/**
 * 秒数を `m:ss`（分は桁揃えなし、秒は2桁）へ整形する。四捨五入し、最小は `0:01`。
 *
 * 例:
 * - 入力: `5` → 出力: `"0:05"`
 * - 入力: `600` → 出力: `"10:00"`
 */
export const formatVideoDuration = (sec: number): string => {
    const total = Math.max(1, Math.round(sec))
    return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`
}

/**
 * `composeThumbnailBlob` の描画後に呼ばれる、オーバーレイ描画関数を返す。
 *
 * `scale` は composeThumbnailBlob が渡す「出力長辺 / 1200」で、通常は 1。
 * 寸法には `S = 1200 / referenceCardWidth` を掛けて、X 上での見た目を実測値に合わせる。
 * 円の中心は画像（動画の表示領域）の中心、バッジは左下隅から一定の余白に置く。
 */
export const drawVideoOverlay =
    (durationSec: number) =>
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

        // 3. 再生時間バッジ
        const text = formatVideoDuration(durationSec)
        context.font = `${spec.badgeFontWeight} ${spec.badgeFontSize * s}px sans-serif`
        const textWidth = context.measureText(text).width
        const badgeW = textWidth + 2 * spec.badgePaddingX * s
        const badgeH = spec.badgeHeight * s
        const radius = spec.badgeRadius * s
        const left = spec.badgeMarginLeft * s
        const top = height - spec.badgeMarginBottom * s - badgeH

        context.beginPath()
        context.moveTo(left + radius, top)
        context.arcTo(left + badgeW, top, left + badgeW, top + badgeH, radius)
        context.arcTo(left + badgeW, top + badgeH, left, top + badgeH, radius)
        context.arcTo(left, top + badgeH, left, top, radius)
        context.arcTo(left, top, left + badgeW, top, radius)
        context.closePath()
        context.fillStyle = spec.badgeFill
        context.fill()

        context.fillStyle = spec.badgeTextColor
        context.textAlign = "center"
        context.textBaseline = "middle"
        context.fillText(text, left + badgeW / 2, top + badgeH / 2)
    }
