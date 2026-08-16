/**
 * body のスクロールロックを参照カウントで管理する共有モジュール。
 *
 * 責務と処理概要:
 * - `Overlay` はモーダル表示中、背面のスクロールを止めるため `body` を
 *   `position: fixed` で現在位置に固定する。この処理を Overlay インスタンスごとに
 *   独立して行うと、モーダルが入れ子（例: 投稿フォーム内で下書き保存確認や
 *   画像クロップダイアログを開く）になった際、内側のロックが「既に固定済みで
 *   スクロール可能領域が消失している状態」の `window.scrollY`（常に 0）を
 *   誤って正としてしまい、外側モーダルの表示位置が最上部に飛ぶ。
 * - ロック要求をカウントし、0→1 の遷移でのみ実際に固定・位置保存を行い、
 *   1→0 の遷移でのみ復元することで、何重に入れ子になっても最初に保存した
 *   スクロール位置だけを基準に正しく復元できるようにする。
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
