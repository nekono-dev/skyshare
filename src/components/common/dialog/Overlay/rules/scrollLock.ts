/**
 * 入れ子のオーバーレイ間で body のスクロールロックを共有する。
 *
 * - 最初の要求で位置と body のスタイルを保存し、最後の解放で復元する。
 * - ロック中に再取得した `window.scrollY` は 0 になるため、内側の要求では保存位置を更新しない。
 */

let lockCount = 0
let savedScrollY = 0
let savedBodyStyle: {
    position: string
    top: string
    left: string
    right: string
    width: string
} | null = null

/**
 * スクロールロックを1件要求する。
 *
 * Output:
 * - なし（最初の要求時のみ現在のスクロール位置を保存し、body を固定する）
 */
export const acquireScrollLock = () => {
    if (typeof document === "undefined") return

    lockCount += 1
    if (lockCount > 1) return

    savedScrollY = window.scrollY
    savedBodyStyle = {
        position: document.body.style.position,
        top: document.body.style.top,
        left: document.body.style.left,
        right: document.body.style.right,
        width: document.body.style.width,
    }
    document.body.style.position = "fixed"
    document.body.style.top = `-${savedScrollY}px`
    document.body.style.left = "0"
    document.body.style.right = "0"
    document.body.style.width = "100%"
}

/**
 * スクロールロックの要求を1件解除する。
 *
 * Output:
 * - なし（最後の要求が解除されたときのみ body を復元し、保存位置へスクロールし直す）
 */
export const releaseScrollLock = () => {
    if (typeof document === "undefined") return

    lockCount = Math.max(0, lockCount - 1)
    if (lockCount > 0) return

    if (savedBodyStyle) {
        document.body.style.position = savedBodyStyle.position
        document.body.style.top = savedBodyStyle.top
        document.body.style.left = savedBodyStyle.left
        document.body.style.right = savedBodyStyle.right
        document.body.style.width = savedBodyStyle.width
        savedBodyStyle = null
    }
    window.scrollTo(0, savedScrollY)
}
