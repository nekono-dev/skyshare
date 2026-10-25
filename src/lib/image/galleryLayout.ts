/**
 * 画像ギャラリーのレイアウト判定。
 *
 * 責務と処理概要:
 * - 画像枚数と縦横比から、サムネイル表示の構成（grid / strip）を決める純関数を提供する。
 * - 4枚以下は比率固定のグリッド、5枚以上は高さ固定の横スクロール（specs/image-gallery）。
 */
import type { SourceImage } from "@/lib/entry/entry"

export type GalleryLayout =
    | { kind: "grid"; count: 1 | 2 | 3 | 4; singleRatio?: number } // singleRatio は count===1 のときのみ
    | { kind: "strip" }

/** グリッド表示とする最大枚数 */
export const GRID_MAX_COUNT = 4
/** 1枚表示の縦長側の下限（width/height） */
export const SINGLE_RATIO_MIN = 0.75
/** 1枚表示の横長側の上限（width/height） */
export const SINGLE_RATIO_MAX = 2
/** 縦横比が不明な場合に仮定する比率（3:2） */
const UNKNOWN_RATIO = 1.5

export const resolveGalleryLayout = (
    images: SourceImage[],
): GalleryLayout | null => {
    if (images.length === 0) return null
    if (images.length > GRID_MAX_COUNT) return { kind: "strip" }
    if (images.length === 1) {
        const r = images[0].aspectRatio
        const raw = r ? r.width / r.height : UNKNOWN_RATIO
        const singleRatio = Math.min(
            SINGLE_RATIO_MAX,
            Math.max(SINGLE_RATIO_MIN, raw),
        )
        return { kind: "grid", count: 1, singleRatio }
    }
    return { kind: "grid", count: images.length as 2 | 3 | 4 }
}
