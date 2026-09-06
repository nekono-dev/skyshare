/**
 * ログイン不要のゲスト表示（URLクエリパラメータ方式）に関する共通ヘルパー。
 *
 * 責務と処理概要:
 * - 未ログイン時、URLに `?guest` が付与されている場合のみ実データ取得の代わりに
 *   ダミーデータを表示する「ゲストモード」への切り替えを許可する。
 * - ログイン済みユーザーには一切影響しない（各画面側で「未ログイン(401)」の
 *   分岐内でのみこのモジュールを参照する）。
 * - サイドバー等の内部ナビゲーションリンクでもこのクエリパラメータを引き継げるよう、
 *   href へ付与するヘルパーも提供する。
 */

export const GUEST_MODE_QUERY_KEY = "guest"

/**
 * 現在のブラウザURLにゲストモードを要求するクエリパラメータが付いているかを判定する。
 *
 * Output:
 * - SSR環境（`window` 不在）では常に `false`
 */
export const isGuestModeRequested = (): boolean => {
    if (typeof window === "undefined") return false
    return new URLSearchParams(window.location.search).has(GUEST_MODE_QUERY_KEY)
}

/**
 * 内部ナビゲーションリンクの href に、ゲストモードのクエリパラメータを引き継がせる。
 *
 * Input:
 * - `href`: 遷移先のパス（例: `/entries/`）
 * - `guestModeActive`: 現在ゲストモード表示中かどうか
 *
 * Output:
 * - `guestModeActive` が `false` ならそのままの `href`
 * - `true` なら `?guest=1` を付与した `href`
 *
 * 例:
 * - 入力: `href="/entries/"`, `guestModeActive=true`
 * - 出力: `"/entries/?guest=1"`
 */
export const withGuestModeQuery = (
    href: string,
    guestModeActive: boolean,
): string => {
    if (!guestModeActive) return href
    const separator = href.includes("?") ? "&" : "?"
    return `${href}${separator}${GUEST_MODE_QUERY_KEY}=1`
}
