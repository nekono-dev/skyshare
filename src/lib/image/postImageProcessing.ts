import type { Area } from "react-easy-crop"

/**
 * 投稿画像の切り抜き・合成・圧縮を扱う画像処理ユーティリティ群。
 *
 * 責務と処理概要:
 * - OGP 仕様（1200x630）に合わせたスロット定義と中央基準クロップ計算を提供する。
 * - Canvas への描画結果を、用途ごとの atproto 実上限（バイト予算）に収まる画像 Blob へ圧縮する。
 *   PNG（可逆）を優先的に試し、収まらない場合のみ JPEG 品質の二分探索・解像度縮小を行う。
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

const MAX_SOURCE_SIDE = 4096 // 元画像取り込み時の長辺上限（メモリ保護）
const JPEG_QUALITY_CEILING = 0.98
const JPEG_QUALITY_FLOOR = 0.8 // これを下回る前に解像度縮小を優先する
const JPEG_QUALITY_SEARCH_ITERATIONS = 6
const LOSSLESS_ATTEMPT_MAX_SIDE = 2048 // これを超える長辺ではPNG先行試行をスキップする
// これ以上は縮小しない安全弁。byteBudget はサーバー側のハード上限に対応するため、
// この値はUXのための下限ではなく、無限ループを防ぐためだけの理論上到達しない最終防衛ライン。
// この解像度まで縮小すればどの byteBudget に対しても実質的に必ず収まる。
const ABSOLUTE_MIN_OUTPUT_SIDE = 64

/**
 * atproto 側の実上限（安全マージン込み）。上限が変わった場合はここだけ更新すればよい。
 * - POST_IMAGE_BYTE_BUDGET: app.bsky.embed.images#image.maxSize = 2,000,000
 *   （Bluesky投稿本体の添付画像。旧 1,000,000 から引き上げ済み）
 * - LINK_CARD_THUMBNAIL_BYTE_BUDGET: app.bsky.embed.external#external.thumb.maxSize = 1,000,000
 *   （OGPリンクカードのサムネイル）
 * - COMPOSITE_VISUAL_BYTE_BUDGET: dev.nekono.skyshare.entry の manifest.visual
 *   （自前ブロブで上限指定なし、実用上の目安値として据え置く）
 */
const POST_IMAGE_BYTE_BUDGET = 1_900_000
const LINK_CARD_THUMBNAIL_BYTE_BUDGET = 950_000
const COMPOSITE_VISUAL_BYTE_BUDGET = 1_000_000

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
 * Canvas を PNG（可逆圧縮）Blob へ変換する。
 *
 * Input:
 * - `canvas`: 変換元キャンバス
 *
 * Output:
 * - 変換後 Blob
 *
 * 例:
 * - 入力: `canvas`
 * - 出力: `image/png` Blob
 */
const canvasToPngBlob = (canvas: HTMLCanvasElement) =>
    new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(blob => {
            if (!blob) {
                reject(new Error("画像の変換に失敗しました。"))
                return
            }
            resolve(blob)
        }, "image/png")
    })

/**
 * 目標長辺サイズを受け取り、その解像度で描画済みキャンバスを返す関数。
 *
 * 処理の趣旨:
 * - `compressToByteBudget` が解像度を縮小するたびに呼び直し、常に元の描画ソースから
 *   再サンプリングさせるための抽象化。縮小済みキャンバスを再度縮小する多重リサンプリングを避ける。
 */
type CanvasRenderer = (longSide: number) => HTMLCanvasElement

/**
 * 予算内に収まる JPEG 品質を探す。
 *
 * 処理の趣旨:
 * - 品質上限でまず判定し、収まればそれを採用する。
 * - 収まらない場合は品質下限で判定し、下限でも収まらないなら `withinBudget: false` を返して
 *   呼び出し元に解像度縮小を促す（画質を犠牲にしすぎる前に解像度側で調整するため）。
 * - 下限で収まる場合のみ `[品質下限, 品質上限]` を二分探索し、予算を使い切れる最高品質を探す。
 *
 * Input:
 * - `canvas`: 対象キャンバス
 * - `byteBudget`: 目標上限バイト数
 *
 * Output:
 * - `blob`: 見つかった最良の JPEG Blob
 * - `withinBudget`: 予算内に収まったか
 *
 * 例:
 * - 入力: `(canvas, 1900000)`
 * - 出力: `{ blob, withinBudget: true }`（品質0.8〜0.98の間で予算を使い切る品質）
 */
const searchJpegQualityWithinBudget = async (
    canvas: HTMLCanvasElement,
    byteBudget: number,
): Promise<{ blob: Blob; withinBudget: boolean }> => {
    const ceilingBlob = await canvasToJpegBlob(canvas, JPEG_QUALITY_CEILING)
    if (ceilingBlob.size <= byteBudget) {
        return { blob: ceilingBlob, withinBudget: true }
    }

    const floorBlob = await canvasToJpegBlob(canvas, JPEG_QUALITY_FLOOR)
    if (floorBlob.size > byteBudget) {
        return { blob: floorBlob, withinBudget: false }
    }

    let lo = JPEG_QUALITY_FLOOR
    let hi = JPEG_QUALITY_CEILING
    let best = floorBlob

    for (let i = 0; i < JPEG_QUALITY_SEARCH_ITERATIONS; i += 1) {
        const mid = (lo + hi) / 2
        const midBlob = await canvasToJpegBlob(canvas, mid)
        if (midBlob.size <= byteBudget) {
            best = midBlob
            lo = mid
        } else {
            hi = mid
        }
    }

    return { blob: best, withinBudget: true }
}

/**
 * 指定バイト予算に収まる画像 Blob を、画質をできる限り保って生成する。
 *
 * 責務:
 * - Bluesky投稿添付画像・OGPリンクカードサムネイル・合成サムネイルの3用途すべてで
 *   共有される単一の圧縮エンジン。用途ごとの違いは `render`（描画方法）と `byteBudget`
 *   （バイト予算）の引数だけで表現し、用途固有のロジックを重複させない。
 * - `byteBudget` は atproto 側のハード上限に対応するため、原則としてこれを超える Blob を
 *   返してはならない（超過するとサーバー側でアップロード自体が拒否される）。そのため
 *   「規定回数/規定解像度まで試して駄目なら諦めて予算超過のまま返す」という妥協はせず、
 *   予算内に収まるまで解像度を縮小し続ける。
 *
 * 処理の趣旨:
 * - まず可逆圧縮（PNG）を試し、予算内に収まればそれを採用する（`LOSSLESS_ATTEMPT_MAX_SIDE`
 *   以下の解像度のみ。スクリーンショットやイラスト等で画質を一切落とさず投稿できる）。
 * - 次に JPEG 品質を二分探索し、予算内に収まる最高品質を選ぶ。
 * - 品質下限（`JPEG_QUALITY_FLOOR`）でも収まらない場合のみ解像度を縮小して再試行する。
 *   縮小のたびに `render` を呼び直し、常に元の描画ソースから再サンプリングすることで、
 *   縮小済みキャンバスを再度縮小する多重リサンプリングによる画質劣化の蓄積を避ける。
 * - `ABSOLUTE_MIN_OUTPUT_SIDE` は「これ以上は諦める」ための実用的な下限ではなく、無限ループを
 *   防ぐためだけの理論上到達しない安全弁である（この解像度まで縮小すればどの byteBudget に対しても
 *   実質的に必ず収まる）。
 *
 * Input:
 * - `render`: 目標長辺サイズを受け取り、その解像度で描画済みキャンバスを返す関数
 * - `initialLongSide`: 初期描画で使う目標長辺サイズ
 * - `byteBudget`: 出力 Blob の目標上限バイト数
 *
 * Output:
 * - `byteBudget` 以下の `image/png` または `image/jpeg` Blob
 *
 * 例:
 * - 入力: `render`=元画像から描画する関数, `initialLongSide`=4096, `byteBudget`=1900000
 * - 出力: 1.9MB以下に収まる高品質 JPEG（条件次第で PNG）
 */
const compressToByteBudget = async (
    render: CanvasRenderer,
    initialLongSide: number,
    byteBudget: number,
): Promise<Blob> => {
    let longSide = initialLongSide
    let canvas = render(longSide)

    while (true) {
        if (
            Math.max(canvas.width, canvas.height) <= LOSSLESS_ATTEMPT_MAX_SIDE
        ) {
            const pngBlob = await canvasToPngBlob(canvas)
            if (pngBlob.size <= byteBudget) {
                return pngBlob
            }
        }

        const result = await searchJpegQualityWithinBudget(canvas, byteBudget)

        if (result.withinBudget) {
            return result.blob
        }

        if (longSide <= ABSOLUTE_MIN_OUTPUT_SIDE) {
            return result.blob
        }

        const scaleRatio = Math.sqrt(byteBudget / result.blob.size) * 0.95
        const clampedScale = Math.min(0.95, Math.max(0.5, scaleRatio))
        longSide = Math.max(
            ABSOLUTE_MIN_OUTPUT_SIDE,
            Math.round(longSide * clampedScale),
        )
        canvas = render(longSide)
    }
}

/**
 * 元画像全体を、縦横比を保ったまま指定長辺サイズへ高品質リサンプリングする。
 *
 * Input:
 * - `image`: 元画像
 * - `maxLongSide`: 出力の目標長辺サイズ（元画像より大きい場合は拡大しない）
 *
 * Output:
 * - リサイズ済みキャンバス
 *
 * 例:
 * - 入力: `(8000x4000画像, 4096)`
 * - 出力: 4096x2048 相当のキャンバス
 */
const renderImageAtLongSide = (
    image: HTMLImageElement,
    maxLongSide: number,
): HTMLCanvasElement => {
    const naturalLongSide = Math.max(image.naturalWidth, image.naturalHeight)
    const ratio = Math.min(1, maxLongSide / naturalLongSide)
    const width = Math.max(1, Math.round(image.naturalWidth * ratio))
    const height = Math.max(1, Math.round(image.naturalHeight * ratio))
    const canvas = document.createElement("canvas")
    canvas.width = width
    canvas.height = height
    const context = canvas.getContext("2d")

    if (!context) {
        throw new Error("キャンバスの初期化に失敗しました。")
    }

    context.imageSmoothingEnabled = true
    context.imageSmoothingQuality = "high"
    context.drawImage(image, 0, 0, width, height)
    return canvas
}

/**
 * 元画像がそのまま投稿画像として使える条件を満たすかを判定する。
 *
 * 処理の趣旨:
 * - JPEG/PNG は Bluesky が問題なく受理する代表的な形式であり、かつ
 *   `POST_IMAGE_BYTE_BUDGET` 以下なら再圧縮する理由がない。再エンコードは常に
 *   何らかの情報損失（JPEG）や無駄な処理を伴いうるため、条件を満たす場合は
 *   元の Blob をそのままアップロードし、画質を完全に保つ。
 * - JPEG/PNG 以外（webp, heic, gif 等）は無条件で圧縮パイプラインに通し、
 *   Bluesky が確実に扱える形式へ正規化する。
 *
 * Input:
 * - `blob`: 元画像 Blob（ユーザーが選択した File 由来）
 *
 * Output:
 * - そのままアップロード可能なら `true`
 *
 * 例:
 * - 入力: `{ type: "image/jpeg", size: 800000 }`
 * - 出力: `true`
 */
export const canUsePostImageAsIs = (blob: Blob): boolean =>
    (blob.type === "image/jpeg" || blob.type === "image/png") &&
    blob.size <= POST_IMAGE_BYTE_BUDGET

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
                throw new Error("キャンバスの初期化に失敗しました。")
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
): Promise<{ thumbnailBlob: Blob; images: HTMLImageElement[] }> => {
    const slotDefs = getSlotDefs(Math.min(4, Math.max(1, imageUrls.length)))
    const targetUrls = imageUrls.slice(0, slotDefs.length)
    const images = await Promise.all(targetUrls.map(url => loadImage(url)))

    const crops = slotDefs.map((_, index) => {
        const crop = cropStates[index]?.cropPixels
        if (!crop || !images[index]) {
            throw new Error("画像の切り抜き範囲が不正です。")
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
            throw new Error("キャンバスの初期化に失敗しました。")
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
 * - `imageUrls` は 1〜4 枚分を想定（5枚以上は先頭4枚のみ使用）
 * - `cropStates[index].cropPixels` は各画像に対応する切り抜き領域を持つ
 *
 * 処理の趣旨:
 * - `composeThumbnailBlob` で合成サムネイルを生成しつつ、並行して原本 Blob を取得する。
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
 * - `originalBlobs`: 個別処理済み画像（圧縮対象外は元Blobそのもの）
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
    const targetUrls = imageUrls.slice(
        0,
        getSlotDefs(Math.min(4, Math.max(1, imageUrls.length))).length,
    )
    const [{ thumbnailBlob, images }, sourceBlobs] = await Promise.all([
        composeThumbnailBlob(imageUrls, cropStates),
        Promise.all(targetUrls.map(url => fetch(url).then(res => res.blob()))),
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
): Promise<Blob> => {
    const slotDefs = getSlotDefs(Math.min(4, Math.max(1, imageUrls.length)))
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

    const { thumbnailBlob } = await composeThumbnailBlob(targetUrls, cropStates)
    return thumbnailBlob
}
