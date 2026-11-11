/**
 * セッション Cookie の型・符号化・プール・HTTP ヘッダー操作を公開する。
 *
 * - OAuth セッションは約 1.6 KB のため、約 4 KB の Cookie 上限に複数件を収めず、非アクティブ枠を 4 個に制限する。
 * - トークンは HttpOnly Cookie だけに置き、クライアント側ストレージから読めないようにして XSS 時の被害を抑える。
 * - 内部依存は codec → model → pool → headers の一方向とし、外部からはこの入口を使う。
 */

export {
    decodeBase64Utf8,
    encodeBase64Utf8,
    getCookieFromHeader,
    parseCookies,
} from "./codec"

export { SESSION_COOKIE_NAME, sessionIdentity, toPooledAccount } from "./model"
export type {
    OAuthSession,
    OAuthTokens,
    PasswordSession,
    PooledAccount,
    StoredSession,
} from "./model"

export { MAX_POOLED_ACCOUNTS, admitSession, upsertPooledAccount } from "./pool"

export {
    makeAccountsSetCookies,
    makeClearSetCookie,
    makeSessionSetCookie,
    parseAccountsFromRequest,
    parseSessionFromRequest,
} from "./headers"
