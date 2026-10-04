import type { CSSProperties } from "react"
import type { Area } from "react-easy-crop"

/**
 * サムネイル生成時に使われるクロップ範囲を、個別プレビュー画像へ視覚的に反映するための
 * インラインスタイルを算出する。
 *
 * 処理の趣旨:
 * - Blueskyへ投稿する原本画像自体はクロップしない（クロップ状態は合成サムネイル生成専用の
 *   情報）ため、ここでは「作成される予定のサムネイル」を見せるための表示上のクロップのみを
 *   行う。実際の画像切り抜きは行わず、`position:absolute` + 拡大率でクロップ範囲が
 *   コンテナいっぱいに映るよう配置する（`object-fit`では矩形任意位置の切り抜きを表現できないため）。
 * - クロップ範囲や元画像サイズが未確定な場合は、通常の中央基準カバー表示にフォールバックする。
 *
 * Input:
 * - `crop`: クロップ範囲（元画像のピクセル座標）。未確定なら null
 * - `naturalWidth` / `naturalHeight`: 元画像の寸法
 *
 * Output:
 * - `<img>` に適用するインラインスタイル
 */
export const computeCroppedImageStyle = (
    crop: Area | null,
    naturalWidth?: number,
    naturalHeight?: number,
): CSSProperties => {
    if (!crop || !naturalWidth || !naturalHeight) {
        return {
            display: "block",
            width: "100%",
            height: "100%",
            objectFit: "cover",
        }
    }

    return {
        display: "block",
        position: "absolute",
        left: `${(-crop.x / crop.width) * 100}%`,
        top: `${(-crop.y / crop.height) * 100}%`,
        width: `${(naturalWidth / crop.width) * 100}%`,
        height: `${(naturalHeight / crop.height) * 100}%`,
        maxWidth: "none",
    }
}
