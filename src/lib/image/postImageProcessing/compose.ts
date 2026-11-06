/**
 * 複数画像を OGP レイアウトへ合成し、投稿用の画像とサムネイルを作る（合成と公開の処理）。
 *
 * 責務と処理概要:
 * - 切り抜きの幾何（geometry）・読み込み（source）・圧縮（encode）を組み合わせ、公開の関数を提供する。
 * - 公開の関数: `createOgpThumbnailFromBlob`・`createProcessedImages`・`createCroppedThumbnail`・`createDefaultThumbnail`。
 */
import { VISUAL_IMAGE_COUNT } from "@/lib/image/postImageLimits"
import {
    computeCropAroundCenter,
    computeInitialCrop,
    getSlotDefs,
    SlotCropState,
    TARGET_HEIGHT,
    TARGET_WIDTH,
} from "./geometry"
import { loadImage, loadImageSize } from "./source"
import {
    CanvasRenderer,
    canUsePostImageAsIs,
    COMPOSITE_VISUAL_BYTE_BUDGET,
    compressToByteBudget,
    LINK_CARD_THUMBNAIL_BYTE_BUDGET,
    MAX_SOURCE_SIDE,
    POST_IMAGE_BYTE_BUDGET,
    renderImageAtLongSide,
} from "./encode"

/**
 * 単一 Blob 画像から OGP サムネイル（1200x630）を生成する。
 *
 * Input:
 * - `inputBlob`: 元画像 Blob
 *
 * Output:
 * - OGP 用画像 Blob（`app.bsky.embed.external#external.thumb` の実上限に収まる）
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

        const render: CanvasRenderer = longSide => {
            const scale = longSide / TARGET_WIDTH
            const width = Math.max(1, Math.round(TARGET_WIDTH * scale))
            const height = Math.max(1, Math.round(TARGET_HEIGHT * scale))
            const canvas = document.createElement("canvas")
            canvas.width = width
            canvas.height = height
            const context = canvas.getContext("2d")

            if (!context) {
                throw new Error("Failed to initialize the canvas.")
            }

            context.imageSmoothingEnabled = true
            context.imageSmoothingQuality = "high"
            context.drawImage(
                image,
                crop.x,
                crop.y,
                crop.width,
                crop.height,
                0,
                0,
                width,
                height,
            )
            return canvas
        }

        return await compressToByteBudget(
            render,
            TARGET_WIDTH,
            LINK_CARD_THUMBNAIL_BYTE_BUDGET,
        )
    } finally {
        URL.revokeObjectURL(objectUrl)
    }
}

/**
 * 合成済みの画像の上に重ねて描く処理（動画の再生ボタン等）。
 * `scale` は「出力長辺 / `TARGET_WIDTH`」。縮小描画のたびに呼ばれるため、
 * 呼び出し側は `scale` を掛けた寸法で描く。
 */
export type CompositeOverlay = (
    context: CanvasRenderingContext2D,
    scale: number,
) => void

/**
 * スロット定義・クロップ座標に沿って複数画像を1枚のサムネイルへ合成する。
 *
 * 想定する入力形状(最小要件):
 * - `imageUrls` は 1〜4 枚分を想定（5枚以上は先頭4枚のみ使用）
 * - `cropStates[index].cropPixels` は各画像に対応する切り抜き領域を持つ
 *
 * 処理の趣旨:
 * - `createProcessedImages`（投稿フォーム、原本画像のアップロードも伴う）と
 *   `createDefaultThumbnail`（Timelineからのentry作成、合成サムネイルのみ必要）の
 *   両方から共有される合成処理の核。読み込み済み `images` も返し、呼び出し元が
 *   原本画像の再圧縮などに二重ロードせず使い回せるようにする。
 *
 * Input:
 * - `imageUrls`: 元画像 URL 配列
 * - `cropStates`: 画像ごとのクロップ状態配列
 *
 * Output:
 * - `thumbnailBlob`: 合成サムネイル
 * - `images`: 読み込み済み `HTMLImageElement` 配列（スロット順）
 *
 * 例:
 * - 入力: 2枚の画像URL + 2件の cropPixels
 * - 出力: 1件の thumbnailBlob と 2件の images
 */
const composeThumbnailBlob = async (
    imageUrls: string[],
    cropStates: SlotCropState[],
    overlay?: CompositeOverlay,
): Promise<{ thumbnailBlob: Blob; images: HTMLImageElement[] }> => {
    const slotDefs = getSlotDefs(
        Math.min(VISUAL_IMAGE_COUNT, Math.max(1, imageUrls.length)),
    )
    const targetUrls = imageUrls.slice(0, slotDefs.length)
    const images = await Promise.all(targetUrls.map(url => loadImage(url)))

    const crops = slotDefs.map((_, index) => {
        const crop = cropStates[index]?.cropPixels
        if (!crop || !images[index]) {
            throw new Error("The image crop area is invalid.")
        }
        return crop
    })

    // 合成サムネイル用の render: スロット定義・クロップ座標をスケールして毎回描き直す。
    const renderComposite: CanvasRenderer = longSide => {
        const scale = longSide / TARGET_WIDTH
        const canvas = document.createElement("canvas")
        canvas.width = Math.max(1, Math.round(TARGET_WIDTH * scale))
        canvas.height = Math.max(1, Math.round(TARGET_HEIGHT * scale))
        const context = canvas.getContext("2d")

        if (!context) {
            throw new Error("Failed to initialize the canvas.")
        }

        context.imageSmoothingEnabled = true
        context.imageSmoothingQuality = "high"

        slotDefs.forEach((slotDef, index) => {
            const crop = crops[index]
            context.drawImage(
                images[index],
                crop.x,
                crop.y,
                crop.width,
                crop.height,
                slotDef.x * scale,
                slotDef.y * scale,
                slotDef.w * scale,
                slotDef.h * scale,
            )
        })

        overlay?.(context, scale)

        return canvas
    }

    const thumbnailBlob = await compressToByteBudget(
        renderComposite,
        TARGET_WIDTH,
        COMPOSITE_VISUAL_BYTE_BUDGET,
    )

    return { thumbnailBlob, images }
}

/**
 * 複数画像を OGP レイアウトへ合成し、投稿用画像セットを生成する。
 *
 * 想定する入力形状(最小要件):
 * - `imageUrls` は 1〜`MAX_POST_IMAGES` 枚分。visual（合成サムネイル）には先頭4枚のみ使い、
 *   5枚目以降は原本 Blob の処理のみ行う
 * - `cropStates[index].cropPixels` は先頭4枚それぞれの切り抜き領域を持つ（5枚目以降は不要）
 *
 * 処理の趣旨:
 * - `composeThumbnailBlob` で先頭4枚から合成サムネイルを生成しつつ、並行して全画像の原本 Blob を取得する。
 * - 同時に各画像について `canUsePostImageAsIs` で圧縮要否を判定し、既に投稿条件を
 *   満たす画像（JPEG/PNG かつ予算内）は元Blobをそのまま採用、満たさない画像のみ
 *   個別リサイズ+圧縮して原本配列として返す。
 * - 必須データ欠落時は早期にエラー化し、壊れた合成結果の生成を防ぐ。
 *
 * Input:
 * - `imageUrls`: 元画像 URL 配列
 * - `cropStates`: 画像ごとのクロップ状態配列
 *
 * Output:
 * - `originalBlobs`: 全画像分の個別処理済み画像（圧縮対象外は元Blobそのもの）
 * - `thumbnailBlob`: 合成サムネイル
 *
 * 例:
 * - 入力: 5枚の画像URL + 先頭4件の cropPixels
 * - 出力: 5件の originalBlobs と 1件の thumbnailBlob（先頭4枚由来）
 */
export const createProcessedImages = async (
    imageUrls: string[],
    cropStates: SlotCropState[],
) => {
    // visual の素材は先頭 VISUAL_IMAGE_COUNT 枚のみ。原本（投稿に添付する画像）は全枚数を処理する。
    const [{ thumbnailBlob }, sourceBlobs, images] = await Promise.all([
        composeThumbnailBlob(
            imageUrls.slice(0, VISUAL_IMAGE_COUNT),
            cropStates.slice(0, VISUAL_IMAGE_COUNT),
        ),
        Promise.all(imageUrls.map(url => fetch(url).then(res => res.blob()))),
        Promise.all(imageUrls.map(url => loadImage(url))),
    ])

    // 既に投稿条件（JPEG/PNG かつ予算内）を満たす画像は圧縮対象外として元Blobをそのまま採用し、
    // 満たさない画像のみ圧縮対象として圧縮エンジンに通す。
    const originalBlobs = await Promise.all(
        images.map((image, index) => {
            const sourceBlob = sourceBlobs[index]
            if (canUsePostImageAsIs(sourceBlob)) {
                return sourceBlob
            }
            return compressToByteBudget(
                longSide => renderImageAtLongSide(image, longSide),
                MAX_SOURCE_SIDE,
                POST_IMAGE_BYTE_BUDGET,
            )
        }),
    )

    return { originalBlobs, thumbnailBlob }
}

/**
 * 指定のクロップ状態で画像を合成し、サムネイルだけを生成する。
 *
 * 処理の趣旨:
 * - 動画投稿の visual 調整のように、原本画像の処理（`createProcessedImages` の
 *   `originalBlobs`）が不要で、合成サムネイルだけが必要な場合に使う。
 *
 * Input:
 * - `imageUrls`: 元画像 URL 配列
 * - `cropStates`: 画像ごとのクロップ状態配列（`cropPixels` が欠けていると throw する）
 * - `overlay`: 合成後に重ねて描く処理（任意）
 *
 * Output:
 * - 合成サムネイル Blob
 */
export const createCroppedThumbnail = async (
    imageUrls: string[],
    cropStates: SlotCropState[],
    overlay?: CompositeOverlay,
): Promise<Blob> => {
    const { thumbnailBlob } = await composeThumbnailBlob(
        imageUrls,
        cropStates,
        overlay,
    )
    return thumbnailBlob
}

/**
 * クロップ編集を行わなかった場合の「デフォルト配置」で複数画像をサムネイルへ合成する。
 *
 * 処理の趣旨:
 * - 投稿フォーム（`ImagePicker`）がクロップダイアログを開かず画像を追加した場合と同じ、
 *   `getSlotDefs` によるスロット定義 + `computeInitialCrop` による中央基準クロップを使う。
 * - Timelineからのentry作成など、ユーザーによるクロップ編集を経ない場面で使用する。
 *
 * 想定する入力形状(最小要件):
 * - `imageUrls` は 1〜4 枚分を想定（5枚以上は先頭4枚のみ使用）。CORS制約を避けるため、
 *   呼び出し元は同一オリジンの Blob URL（`URL.createObjectURL` 由来）を渡すこと。
 *
 * Input:
 * - `imageUrls`: 元画像 URL 配列
 * - `overlay`: 合成後に重ねて描く処理（任意。動画の再生ボタン等）
 *
 * Output:
 * - 合成済みサムネイル Blob
 *
 * 例:
 * - 入力: 3枚の画像URL
 * - 出力: 左1+右上下2のデフォルト配置で合成された Blob
 */
export const createDefaultThumbnail = async (
    imageUrls: string[],
    overlay?: CompositeOverlay,
): Promise<Blob> => {
    const slotDefs = getSlotDefs(
        Math.min(VISUAL_IMAGE_COUNT, Math.max(1, imageUrls.length)),
    )
    const targetUrls = imageUrls.slice(0, slotDefs.length)
    const sizes = await Promise.all(targetUrls.map(url => loadImageSize(url)))
    const cropStates: SlotCropState[] = sizes.map((size, index) => ({
        crop: { x: 0, y: 0 },
        zoom: 1,
        cropPixels: computeInitialCrop(
            size.width,
            size.height,
            slotDefs[index].w,
            slotDefs[index].h,
        ),
    }))

    const { thumbnailBlob } = await composeThumbnailBlob(
        targetUrls,
        cropStates,
        overlay,
    )
    return thumbnailBlob
}
