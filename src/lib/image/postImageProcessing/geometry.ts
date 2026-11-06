/**
 * 投稿画像の切り抜きの幾何（スロット定義・中心基準のクロップ矩形）を計算する。
 *
 * 責務と処理概要:
 * - OGP 仕様（1200x630）の合成スロット定義と、目標アスペクトに合う切り抜き矩形を返す純粋な計算のみを持つ。
 * - DOM・Canvas・外部パッケージを使わず、入力だけから結果を返す。
 */

/**
 * 切り抜きの範囲（元画像のピクセル座標）。
 *
 * 部品の側（react-easy-crop の `Area`）と同じ形の値を、lib の側で型として持つ。
 * lib は UI のライブラリを import しないため、ここで定義する（構造的な型付けにより、
 * 部品が渡す `Area` の値はそのまま使える）。
 */
export type CropArea = {
    x: number
    y: number
    width: number
    height: number
}

export type SlotCropState = {
    crop: { x: number; y: number }
    zoom: number
    cropPixels: CropArea | null
}

export type SlotDef = {
    x: number
    y: number
    w: number
    h: number
    aspect: number
}

export const TARGET_WIDTH = 1200
export const TARGET_HEIGHT = 630

/**
 * 画像枚数に応じた合成スロット定義を返す。
 *
 * 処理の趣旨:
 * - 1枚: 全面
 * - 2枚: 左右2分割
 * - 3枚: 左1列+右上下2段
 * - 4枚以上: 2x2 グリッド（4枚まで利用）
 *
 * Input:
 * - `count`: 入力画像枚数
 *
 * Output:
 * - 各スロットの `{ x, y, w, h, aspect }` 配列
 *
 * 例:
 * - 入力: `2`
 * - 出力: 左右半分の 2 スロット
 */
export const getSlotDefs = (count: number): SlotDef[] => {
    if (count <= 1) {
        return [
            {
                x: 0,
                y: 0,
                w: TARGET_WIDTH,
                h: TARGET_HEIGHT,
                aspect: TARGET_WIDTH / TARGET_HEIGHT,
            },
        ]
    }

    if (count === 2) {
        return [
            {
                x: 0,
                y: 0,
                w: TARGET_WIDTH / 2,
                h: TARGET_HEIGHT,
                aspect: TARGET_WIDTH / 2 / TARGET_HEIGHT,
            },
            {
                x: TARGET_WIDTH / 2,
                y: 0,
                w: TARGET_WIDTH / 2,
                h: TARGET_HEIGHT,
                aspect: TARGET_WIDTH / 2 / TARGET_HEIGHT,
            },
        ]
    }

    if (count === 3) {
        return [
            {
                x: 0,
                y: 0,
                w: TARGET_WIDTH / 2,
                h: TARGET_HEIGHT,
                aspect: TARGET_WIDTH / 2 / TARGET_HEIGHT,
            },
            {
                x: TARGET_WIDTH / 2,
                y: 0,
                w: TARGET_WIDTH / 2,
                h: TARGET_HEIGHT / 2,
                aspect: TARGET_WIDTH / 2 / (TARGET_HEIGHT / 2),
            },
            {
                x: TARGET_WIDTH / 2,
                y: TARGET_HEIGHT / 2,
                w: TARGET_WIDTH / 2,
                h: TARGET_HEIGHT / 2,
                aspect: TARGET_WIDTH / 2 / (TARGET_HEIGHT / 2),
            },
        ]
    }

    return [
        {
            x: 0,
            y: 0,
            w: TARGET_WIDTH / 2,
            h: TARGET_HEIGHT / 2,
            aspect: TARGET_WIDTH / 2 / (TARGET_HEIGHT / 2),
        },
        {
            x: TARGET_WIDTH / 2,
            y: 0,
            w: TARGET_WIDTH / 2,
            h: TARGET_HEIGHT / 2,
            aspect: TARGET_WIDTH / 2 / (TARGET_HEIGHT / 2),
        },
        {
            x: 0,
            y: TARGET_HEIGHT / 2,
            w: TARGET_WIDTH / 2,
            h: TARGET_HEIGHT / 2,
            aspect: TARGET_WIDTH / 2 / (TARGET_HEIGHT / 2),
        },
        {
            x: TARGET_WIDTH / 2,
            y: TARGET_HEIGHT / 2,
            w: TARGET_WIDTH / 2,
            h: TARGET_HEIGHT / 2,
            aspect: TARGET_WIDTH / 2 / (TARGET_HEIGHT / 2),
        },
    ]
}

/**
 * 画像中心基準の初期クロップ領域を計算する。
 *
 * Input:
 * - `naturalWidth`: 元画像幅
 * - `naturalHeight`: 元画像高
 * - `targetWidth`: 目標幅
 * - `targetHeight`: 目標高
 *
 * Output:
 * - 目標アスペクトに一致するクロップ矩形
 *
 * 例:
 * - 入力: `(1920, 1080, 1200, 630)`
 * - 出力: 中央に寄せた `CropArea`
 */
export const computeInitialCrop = (
    naturalWidth: number,
    naturalHeight: number,
    targetWidth: number,
    targetHeight: number,
): CropArea => {
    return computeCropAroundCenter(
        naturalWidth,
        naturalHeight,
        targetWidth,
        targetHeight,
    )
}

/**
 * 指定中心点の周囲で、目標アスペクトに一致するクロップ矩形を算出する。
 *
 * 処理の趣旨:
 * - 元画像と目標アスペクトを比較し、はみ出さない最大矩形を計算する。
 * - 中心点は画像境界外に出ないよう clamp し、最終的な `x/y` を整数化する。
 *
 * Input:
 * - `naturalWidth`: 元画像幅
 * - `naturalHeight`: 元画像高
 * - `targetWidth`: 目標幅
 * - `targetHeight`: 目標高
 * - `centerX`: クロップ中心X（省略時は画像中央）
 * - `centerY`: クロップ中心Y（省略時は画像中央）
 *
 * Output:
 * - `CropArea`（`x`, `y`, `width`, `height`）
 *
 * 例:
 * - 入力: `(1000, 1000, 1200, 630, 500, 500)`
 * - 出力: 正方画像から横長比率へ切り出した `CropArea`
 */
export const computeCropAroundCenter = (
    naturalWidth: number,
    naturalHeight: number,
    targetWidth: number,
    targetHeight: number,
    centerX: number = naturalWidth / 2,
    centerY: number = naturalHeight / 2,
): CropArea => {
    const targetAspect = targetWidth / targetHeight
    const sourceAspect = naturalWidth / naturalHeight

    let width = naturalWidth
    let height = naturalHeight

    if (sourceAspect > targetAspect) {
        height = naturalHeight
        width = Math.round(targetAspect * height)
    } else {
        width = naturalWidth
        height = Math.round(width / targetAspect)
    }

    const clampedCenterX = Math.min(
        Math.max(centerX, width / 2),
        naturalWidth - width / 2,
    )
    const clampedCenterY = Math.min(
        Math.max(centerY, height / 2),
        naturalHeight - height / 2,
    )

    return {
        x: Math.round(clampedCenterX - width / 2),
        y: Math.round(clampedCenterY - height / 2),
        width,
        height,
    }
}
