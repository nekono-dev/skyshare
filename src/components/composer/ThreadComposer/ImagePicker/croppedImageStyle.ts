/**
 * クロップ範囲を個別プレビューに反映するインラインスタイルを算出する。
 *
 * - 投稿原本は切り抜かず、合成サムネイルの見え方だけをプレビューする。
 * - クロップ範囲か元画像寸法が未確定なら中央基準の cover 表示にする。
 */
import type { CSSProperties } from "react"
import type { Area } from "react-easy-crop"

/**
 * インライン表示用のクロップスタイルを算出する。
 *
 * 処理の趣旨:
 * - `object-fit` では矩形の任意位置の切り抜きを表現できないため、`position:absolute` と拡大率で、クロップ範囲がコンテナいっぱいに映るよう配置する。
 *
 * Input:
 * - `crop`: 元画像上のクロップ範囲（ピクセル座標）。未確定なら null
 * - `naturalWidth` / `naturalHeight`: 元画像の寸法
 *
 * Output:
 * - `<img>` に適用する表示スタイル
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
