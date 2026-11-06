/**
 * セッション管理アーキテクチャ概要:
 * - クライアントはログインで取得した `atp_session` cookie を保持し、サーバー API との通信時に自動的に送信する。
 * - `atp_session` は `StoredSession`（アプリパスワードのセッション、または OAuth のセッション）の JSON を
 *   base64 エンコードしたもので、サーバー側 API は `parseSessionFromRequest` で復号してセッションを再開する。
 *   `kind` の無い値は、以前の形式（`{ session, service }`）のアプリパスワードのセッションとして読む。
 * - セッションの書き込みは `makeSessionSetCookie` を通じて行い、cookie 属性（`HttpOnly`, `SameSite`, `Secure`, `Path`, `Max-Age`）を統一することで
 *   一貫した挙動を保証する。
 * - 複数アカウント切り替え機能のため、非アクティブなアカウントのセッションは `atp_account_0` 〜 `atp_account_3` の
 *   cookie に1件ずつプールとして保持する（`parseAccountsFromRequest` / `makeAccountsSetCookies`）。
 *   OAuth のセッションは DPoP の鍵とアクセストークンを持ち1件で約1.6キロバイトになるため、1つの cookie の上限
 *   （約4キロバイト）に複数件が収まらない。
 *   セッショントークン本体は常に HttpOnly cookie の中にのみ存在し、クライアント JS からは一切参照できない
 *   （localStorage 等クライアント側ストレージにトークンを置かないことが、XSS 時の被害範囲を単一アカウントに限定するための前提）。
 *
 * 責務ごとのファイル（参照は codec → model → pool → headers の一方向）:
 * - `codec.ts`: base64・Cookie ヘッダの解析
 * - `model.ts`: セッションの型と検証
 * - `pool.ts`: 複数アカウントのプールの判断
 * - `headers.ts`: Set-Cookie と Request の解析・組み立て
 *
 * このフォルダの外からは、この index を経由して参照する（`@/lib/session/cookies`）。
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
