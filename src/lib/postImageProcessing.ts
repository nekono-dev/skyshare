import type { Area } from "react-easy-crop"

/**
 * 投稿画像の切り抜き・合成・圧縮を扱う画像処理ユーティリティ群。
 *
 * 責務と処理概要:
 * - OGP 仕様（1200x630）に合わせたスロット定義と中央基準クロップ計算を提供する。
 * - Canvas へ描画した結果を 1MB 以下 JPEG へ圧縮し、投稿用 Blob を生成する。
 * - 複数画像をレイアウト合成したサムネイルと、個別のリサイズ済み原本を同時に作成する。
 */

export type SlotCropState = {
    crop: { x: number; y: number }
    zoom: number
    cropPixels: Area | null
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
const MAX_SIDE = 4096
const MAX_BYTES = 1024 * 1024

/**
 * 画像 URL から `HTMLImageElement` を読み込む。
 *
 * Input:
 * - `url`: 画像 URL（blob URL を含む）
 *
 * Output:
 * - 読み込み完了した `HTMLImageElement`
 *
 * 例:
 * - 入力: `"blob:https://example/..."`
 * - 出力: `naturalWidth`/`naturalHeight` が参照可能な画像オブジェクト
 */
export const loadImage = (url: string) =>
    new Promise<HTMLImageElement>((resolve, reject) => {
        const image = new Image()
        image.onload = () => resolve(image)
        image.onerror = () =>
            reject(new Error("画像の読み込みに失敗しました。"))
        image.src = url
    })

/**
 * 画像 URL の実寸サイズを取得する。
 *
 * Input:
 * - `url`: 画像 URL
 *
 * Output:
 * - `{ width, height }`
 *
 * 例:
 * - 入力: `"https://example.com/a.jpg"`
 * - 出力: `{ width: 1920, height: 1080 }`
 */
export const loadImageSize = async (url: string) => {
    const image = await loadImage(url)
    return { width: image.naturalWidth, height: image.naturalHeight }
}

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
 * - 出力: 中央に寄せた `Area`
 */
export const computeInitialCrop = (
    naturalWidth: number,
    naturalHeight: number,
    targetWidth: number,
    targetHeight: number,
): Area => {
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
 * - `Area`（`x`, `y`, `width`, `height`）
 *
 * 例:
 * - 入力: `(1000, 1000, 1200, 630, 500, 500)`
 * - 出力: 正方画像から横長比率へ切り出した `Area`
 */
export const computeCropAroundCenter = (
    naturalWidth: number,
    naturalHeight: number,
    targetWidth: number,
    targetHeight: number,
    centerX: number = naturalWidth / 2,
    centerY: number = naturalHeight / 2,
): Area => {
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

/**
 * Canvas を JPEG Blob へ変換する。
 *
 * Input:
 * - `canvas`: 変換元キャンバス
 * - `quality`: JPEG 品質（0-1）
 *
 * Output:
 * - 変換後 Blob
 *
 * 例:
 * - 入力: `(canvas, 0.9)`
 * - 出力: `image/jpeg` Blob
 */
const canvasToJpegBlob = (canvas: HTMLCanvasElement, quality: number) =>
    new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
            blob => {
                if (!blob) {
                    reject(new Error("画像の変換に失敗しました。"))
                    return
                }
                resolve(blob)
            },
            "image/jpeg",
            quality,
        )
    })

/**
 * 既存 Canvas を指定サイズへ縮小コピーする。
 *
 * Input:
 * - `source`: 元キャンバス
 * - `width`: 出力幅
 * - `height`: 出力高
 *
 * Output:
 * - リサイズ済みキャンバス
 *
 * 例:
 * - 入力: `(source, 600, 315)`
 * - 出力: 幅600高315の新しいキャンバス
 */
const resizeCanvas = (
    source: HTMLCanvasElement,
    width: number,
    height: number,
) => {
    const canvas = document.createElement("canvas")
    canvas.width = Math.max(1, Math.round(width))
    canvas.height = Math.max(1, Math.round(height))
    const context = canvas.getContext("2d")

    if (!context) {
        throw new Error("キャンバスの初期化に失敗しました。")
    }

    context.drawImage(source, 0, 0, canvas.width, canvas.height)
    return canvas
}

/**
 * Canvas を 1MB 以下の JPEG に圧縮する。
 *
 * 処理の趣旨:
 * - 内側ループで品質を段階的に下げ、サイズ条件を満たすか判定する。
 * - 条件未達時は外側ループで解像度も縮小し、品質低下だけで不足するケースに対応する。
 * - 最小辺制限（512）を下回る場合はこれ以上の劣化を避けて終了する。
 *
 * Input:
 * - `sourceCanvas`: 圧縮対象キャンバス
 *
 * Output:
 * - 圧縮後 JPEG Blob（可能な範囲で 1MB 以下）
 *
 * 例:
 * - 入力: 大きな合成キャンバス
 * - 出力: 投稿可能サイズへ圧縮された JPEG
 */
export const compressToJpegUnder1MB = async (
    sourceCanvas: HTMLCanvasElement,
) => {
    let canvas = sourceCanvas

    while (true) {
        let quality = 0.98
        let blob = await canvasToJpegBlob(canvas, quality)

        while (blob.size > MAX_BYTES && quality > 0.05) {
            quality = Math.max(0.05, quality - 0.05)
            blob = await canvasToJpegBlob(canvas, quality)
        }

        if (blob.size <= MAX_BYTES) {
            return blob
        }

        if (Math.max(canvas.width, canvas.height) <= 512) {
            return blob
        }

        const ratio = Math.sqrt(MAX_BYTES / blob.size) * 0.95
        const scale = Math.min(0.95, Math.max(0.5, ratio))
        canvas = resizeCanvas(
            canvas,
            canvas.width * scale,
            canvas.height * scale,
        )
    }
}

/**
 * 元画像を長辺上限付きでキャンバス化する。
 *
 * 処理の趣旨:
 * - 長辺が `MAX_SIDE` を超える入力を縮小し、過大メモリ使用を抑える。
 *
 * Input:
 * - `image`: 元画像
 *
 * Output:
 * - 長辺最大 `MAX_SIDE` のキャンバス
 *
 * 例:
 * - 入力: 8000x4000 画像
 * - 出力: 4096x2048 相当のキャンバス
 */
export const createResizedCanvas = (image: HTMLImageElement) => {
    const maxLength = Math.max(image.naturalWidth, image.naturalHeight)
    const ratio = maxLength > MAX_SIDE ? MAX_SIDE / maxLength : 1
    const width = Math.round(image.naturalWidth * ratio)
    const height = Math.round(image.naturalHeight * ratio)
    const canvas = document.createElement("canvas")
    canvas.width = width
    canvas.height = height
    const context = canvas.getContext("2d")

    if (!context) {
        throw new Error("キャンバスの初期化に失敗しました。")
    }

    context.drawImage(image, 0, 0, width, height)
    return canvas
}

/**
 * 単一 Blob 画像から OGP サムネイル（1200x630）を生成する。
 *
 * Input:
 * - `inputBlob`: 元画像 Blob
 *
 * Output:
 * - OGP 用 JPEG Blob
 *
 * 例:
 * - 入力: スマホ撮影画像 Blob
 * - 出力: 1200x630 相当にトリミング・圧縮された Blob
 */
export const createOgpThumbnailFromBlob = async (
    inputBlob: Blob,
): Promise<Blob> => {
    const objectUrl = URL.createObjectURL(inputBlob)
    try {
        const image = await loadImage(objectUrl)
        const crop = computeCropAroundCenter(
            image.naturalWidth,
            image.naturalHeight,
            TARGET_WIDTH,
            TARGET_HEIGHT,
        )

        const canvas = document.createElement("canvas")
        canvas.width = TARGET_WIDTH
        canvas.height = TARGET_HEIGHT
        const context = canvas.getContext("2d")

        if (!context) {
            throw new Error("キャンバスの初期化に失敗しました。")
        }

        context.drawImage(
            image,
            crop.x,
            crop.y,
            crop.width,
            crop.height,
            0,
            0,
            TARGET_WIDTH,
            TARGET_HEIGHT,
        )

        return await compressToJpegUnder1MB(canvas)
    } finally {
        URL.revokeObjectURL(objectUrl)
    }
}

/**
 * 複数画像を OGP レイアウトへ合成し、投稿用画像セットを生成する。
 *
 * 想定する入力形状(最小要件):
 * - `imageUrls` は 1〜4 枚分を想定（5枚以上は先頭4枚のみ使用）
 * - `cropStates[index].cropPixels` は各画像に対応する切り抜き領域を持つ
 *
 * 処理の趣旨:
 * - スロット定義に沿って各画像を合成し、サムネイル Blob を生成する。
 * - 同時に各画像を個別リサイズ+圧縮し、原本配列として返す。
 * - 必須データ欠落時は早期にエラー化し、壊れた合成結果の生成を防ぐ。
 *
 * Input:
 * - `imageUrls`: 元画像 URL 配列
 * - `cropStates`: 画像ごとのクロップ状態配列
 *
 * Output:
 * - `originalBlobs`: 個別処理済み画像
 * - `thumbnailBlob`: 合成サムネイル
 *
 * 例:
 * - 入力: 2枚の画像URL + 2件の cropPixels
 * - 出力: 2件の originalBlobs と 1件の thumbnailBlob
 */
export const createProcessedImages = async (
    imageUrls: string[],
    cropStates: SlotCropState[],
) => {
    const slotDefs = getSlotDefs(Math.min(4, Math.max(1, imageUrls.length)))
    const images = await Promise.all(
        imageUrls.slice(0, slotDefs.length).map(loadImage),
    )

    const composite = document.createElement("canvas")
    composite.width = TARGET_WIDTH
    composite.height = TARGET_HEIGHT
    const context = composite.getContext("2d")

    if (!context) {
        throw new Error("キャンバスの初期化に失敗しました。")
    }

    for (let index = 0; index < slotDefs.length; index += 1) {
        const slotDef = slotDefs[index]
        const crop = cropStates[index]?.cropPixels
        const image = images[index]

        if (!crop || !image) {
            throw new Error("画像の切り抜き範囲が不正です。")
        }

        context.drawImage(
            image,
            crop.x,
            crop.y,
            crop.width,
            crop.height,
            slotDef.x,
            slotDef.y,
            slotDef.w,
            slotDef.h,
        )
    }

    const thumbnailBlob = await compressToJpegUnder1MB(composite)
    const originalBlobs = await Promise.all(
        images.map(async image =>
            compressToJpegUnder1MB(createResizedCanvas(image)),
        ),
    )

    return { originalBlobs, thumbnailBlob }
}
