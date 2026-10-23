/**
 * 認可の画面から戻ったときに表示するページ（許可を始めたページ）の受け渡し。
 *
 * 責務と処理概要:
 * - 認可の開始で受け取ったパスを、戻り先（`/oauth/callback/`）だけに送られる短命な cookie に入れる。
 * - 戻り先は cookie のパスへ転送し、cookie を消す。cookie が無い・不正なら設定のページへ転送する。
 *
 * 実装上の制約:
 * - 戻りは別のサイトからの遷移のため、`SameSite=Lax` にする（Strict では届かない）。
 *   cookie はパスだけを持ち、認証には使わない。
 * - 別のオリジンへの転送を防ぐため、`/` で始まり `//` と `\` を含まないパスだけを受け付ける。
 */

export const RETURN_PATH_COOKIE = "schedule_auth_return"

/** 戻り先が見つからないときに表示するページ */
export const DEFAULT_RETURN_PATH = "/settings/"

const COOKIE_PATH = "/oauth/callback/"

/** 認可の開始から戻りまでに許す秒数（認可の途中の状態と同じ10分） */
const COOKIE_MAX_AGE = 10 * 60

const MAX_PATH_LENGTH = 512

/**
 * 同じオリジンのページのパスとして受け付けられるかを判定する。
 *
 * Example: `isSafeReturnPath("/post/?a=1")` → true、`isSafeReturnPath("//evil.example/")` → false
 */
export const isSafeReturnPath = (path: unknown): path is string =>
    typeof path === "string" &&
    path.length > 0 &&
    path.length <= MAX_PATH_LENGTH &&
    path.startsWith("/") &&
    !path.startsWith("//") &&
    !path.includes("\\") &&
    !/[\u0000-\u001f\u007f]/.test(path) &&
    !path.includes("#")

/** 戻り先のパスを入れる `Set-Cookie` の値 */
export const returnPathCookie = (path: string): string =>
    `${RETURN_PATH_COOKIE}=${encodeURIComponent(path)}; Path=${COOKIE_PATH}; Max-Age=${COOKIE_MAX_AGE}; HttpOnly; Secure; SameSite=Lax`

/** 戻り先のパスの cookie を消す `Set-Cookie` の値 */
export const clearReturnPathCookie = (): string =>
    `${RETURN_PATH_COOKIE}=; Path=${COOKIE_PATH}; Max-Age=0; HttpOnly; Secure; SameSite=Lax`

/**
 * 要求の cookie から戻り先のパスを読む。無い・不正なら設定のページを返す。
 *
 * Example: `readReturnPath("schedule_auth_return=%2Fpost%2F")` → `"/post/"`
 */
export const readReturnPath = (cookieHeader: string | null): string => {
    for (const part of (cookieHeader ?? "").split(";")) {
        const [name, ...rest] = part.trim().split("=")
        if (name !== RETURN_PATH_COOKIE) continue
        try {
            const path = decodeURIComponent(rest.join("="))
            if (isSafeReturnPath(path)) return path
        } catch {
            // 壊れた値は使わない
        }
    }
    return DEFAULT_RETURN_PATH
}
