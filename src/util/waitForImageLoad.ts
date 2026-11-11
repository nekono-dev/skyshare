/** 画像 URL が読み込み可能になるまで再試行する。 */

/**
 * 画像URLが読み込み可能になるまで待機する。
 *
 * - CDN で画像を配信できるまで読み込みに失敗するため、一定間隔で再試行する。
 * - 体験改善の best-effort 処理なので、タイムアウト時は例外を投げない。
 *
 * Input:
 * - `url`: 待機対象の画像URL(空文字なら何もしない)
 * - `options.timeoutMs`: 待機全体の上限(ミリ秒)。既定15000
 * - `options.intervalMs`: 再試行の間隔(ミリ秒)。既定1000
 *
 * Output:
 * - 読み込めたら `true`、タイムアウトした場合は `false`
 */
export const waitForImageLoad = async (
    url: string,
    options: { timeoutMs?: number; intervalMs?: number } = {},
): Promise<boolean> => {
    if (!url || typeof Image === "undefined") return false
    const { timeoutMs = 15000, intervalMs = 1000 } = options
    const deadline = Date.now() + timeoutMs

    const tryLoad = (): Promise<boolean> =>
        new Promise(resolve => {
            const img = new Image()
            img.onload = () => resolve(true)
            img.onerror = () => resolve(false)
            img.src = url
        })

    while (true) {
        if (await tryLoad()) return true
        if (Date.now() + intervalMs >= deadline) return false
        await new Promise(resolve => setTimeout(resolve, intervalMs))
    }
}
