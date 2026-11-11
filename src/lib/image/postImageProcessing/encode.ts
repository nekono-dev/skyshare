/**
 * Canvas 画像を、用途ごとのバイト予算に収まるよう圧縮する。
 * - PNG を先に試し、収まらない場合は JPEG 品質と解像度を調整する。
 */

export const MAX_SOURCE_SIDE = 4096 // 元画像取り込み時の長辺上限（メモリ保護）
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
 *   （Bluesky 投稿本体の添付画像）
 * - LINK_CARD_THUMBNAIL_BYTE_BUDGET: app.bsky.embed.external#external.thumb.maxSize = 1,000,000
 *   （OGPリンクカードのサムネイル）
 * - COMPOSITE_VISUAL_BYTE_BUDGET: dev.nekono.skyshare.entry の manifest.visual
 *   （自前ブロブで上限指定なし、実用上の目安値として据え置く）
 */
export const POST_IMAGE_BYTE_BUDGET = 1_900_000
export const LINK_CARD_THUMBNAIL_BYTE_BUDGET = 950_000
export const COMPOSITE_VISUAL_BYTE_BUDGET = 1_000_000

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
                    reject(new Error("Failed to convert the image."))
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
                reject(new Error("Failed to convert the image."))
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
export type CanvasRenderer = (longSide: number) => HTMLCanvasElement

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
export const compressToByteBudget = async (
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
export const renderImageAtLongSide = (
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
        throw new Error("Failed to initialize the canvas.")
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
