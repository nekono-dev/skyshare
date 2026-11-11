/**
 * OAuth 認可後に用途と開始元ページへ戻すための情報を受け渡す。
 * - Cookie は callback にだけ送る短命な値で、用途とパスを保持し認証には使わない。
 * - 別サイトから戻るため `SameSite=Lax` を使い、`/` 始まりで `//` と `\` を含まないパスに限る。
 */

/** 戻りの用途 */
export type ReturnPurpose = "schedule" | "session"

const RETURN_COOKIE = "oauth_return"

/** 用途ごとの既定のページ */
const DEFAULT_RETURN_PATHS: Record<ReturnPurpose, string> = {
    schedule: "/settings/",
    session: "/login/",
}

const COOKIE_PATH = "/oauth/callback/"

/** 認可の開始から戻りまでに許す秒数（認可の途中の状態と同じ10分） */
const COOKIE_MAX_AGE = 10 * 60

const MAX_PATH_LENGTH = 512

const isPurpose = (value: unknown): value is ReturnPurpose =>
    value === "schedule" || value === "session"

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

/**
 * 用途とページを入れる `Set-Cookie` の値。ページが不正なら用途の既定のページを入れる。
 *
 * Example: `returnCookie("session", "/accounts/")` → `"oauth_return=session%3A%2Faccounts%2F; Path=/oauth/callback/; ..."`
 */
export const returnCookie = (
    purpose: ReturnPurpose,
    path: string | undefined,
): string => {
    const page = isSafeReturnPath(path) ? path : DEFAULT_RETURN_PATHS[purpose]
    return `${RETURN_COOKIE}=${encodeURIComponent(`${purpose}:${page}`)}; Path=${COOKIE_PATH}; Max-Age=${COOKIE_MAX_AGE}; HttpOnly; Secure; SameSite=Lax`
}

/** 戻り先の cookie を消す `Set-Cookie` の値 */
export const clearReturnCookie = (): string =>
    `${RETURN_COOKIE}=; Path=${COOKIE_PATH}; Max-Age=0; HttpOnly; Secure; SameSite=Lax`

/**
 * 要求の cookie から用途とページを読む。
 *
 * Output: 用途とページ。cookie が無い・用途が不正・壊れているときは予約の設定のページ
 *
 * 例:
 * - 入力: `"oauth_return=session%3A%2Faccounts%2F"` → 出力: `{ purpose: "session", path: "/accounts/" }`
 * - 入力: `"oauth_return=session%3A%2F%2Fevil.example%2F"` → 出力: `{ purpose: "session", path: "/login/" }`
 * - 入力: `null` → 出力: `{ purpose: "schedule", path: "/settings/" }`
 */
export const readReturn = (
    cookieHeader: string | null,
): { purpose: ReturnPurpose; path: string } => {
    const fallback = {
        purpose: "schedule" as const,
        path: DEFAULT_RETURN_PATHS.schedule,
    }
    for (const part of (cookieHeader ?? "").split(";")) {
        const [name, ...rest] = part.trim().split("=")
        if (name !== RETURN_COOKIE) continue
        let value: string
        try {
            value = decodeURIComponent(rest.join("="))
        } catch {
            return fallback
        }
        // 値は「用途:ページ」。ページに ":" が含まれうるため最初の区切りだけで分ける
        const sep = value.indexOf(":")
        const purpose = sep === -1 ? "" : value.slice(0, sep)
        if (!isPurpose(purpose)) return fallback
        const path = value.slice(sep + 1)
        return {
            purpose,
            path: isSafeReturnPath(path) ? path : DEFAULT_RETURN_PATHS[purpose],
        }
    }
    return fallback
}
