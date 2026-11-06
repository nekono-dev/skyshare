/**
 * 画像 URL を `HTMLImageElement` として読み込む（画像の読み込み）。
 *
 * 責務と処理概要:
 * - 読み込みの完了・失敗を Promise で返し、実寸サイズの取得を提供する。
 * - Canvas への描画や圧縮は行わない（`encode`・`compose` が使う）。
 */

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
        image.onerror = () => reject(new Error("Failed to load the image."))
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
