/**
 * 画像URLが読み込み可能になるまで待機する。
 *
 * 処理の趣旨:
 * - 生成直後の画像はCDN側で配信可能になるまで数秒かかり、その間は読み込みに失敗する。
 *   失敗した場合は一定間隔で再試行し、読み込めた時点（または全体のタイムアウト）で戻る。
 * - 待機はあくまで体験改善が目的のbest-effort処理のため、タイムアウトしても例外は投げない。
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
