/**
 * セッション管理アーキテクチャ概要:
 * - クライアントは `/api/login` で取得した `atp_session` cookie を保持し、サーバー API との通信時に自動的に送信する。
 * - `atp_session` は `{ session, service }` を含む JSON を base64 エンコードしたもので、サーバー側 API は `parseSessionFromRequest` で復号し
 *   `AtpAgent` を再開することで認証情報を再利用する。
 * - セッションの書き込みは `makeSessionSetCookie` を通じて行い、cookie 属性（`HttpOnly`, `SameSite`, `Secure`, `Path`, `Max-Age`）を統一することで
 *   一貫した挙動を保証する。
 * - 複数アカウント切り替え機能のため、非アクティブなアカウントのセッションは `atp_accounts` cookie にプールとして保持する。
 *   `atp_session` と同じ base64 JSON 方式・cookie 属性を用いる（`parseAccountsFromRequest` / `makeAccountsSetCookie`）。
 *   セッショントークン本体は常に HttpOnly cookie の中にのみ存在し、クライアント JS からは一切参照できない
 *   （localStorage 等クライアント側ストレージにトークンを置かないことが、XSS 時の被害範囲を単一アカウントに限定するための前提）。
 */

import { atpService } from "../env"

// Cloudflare Workers 環境では Node の `Buffer` が存在しないため
// Web 標準 API (TextEncoder/TextDecoder + atob/btoa) を使って
// UTF-8 対応の base64 encode/decode を行うユーティリティを提供する。
function encodeBase64Utf8(str: string) {
    if (typeof Buffer !== "undefined")
        return Buffer.from(str).toString("base64")
    const bytes = new TextEncoder().encode(str)
    let binary = ""
    for (let i = 0; i < bytes.length; i++)
        binary += String.fromCharCode(bytes[i])
    return (globalThis as any).btoa(binary)
}

function decodeBase64Utf8(b64: string) {
    if (typeof Buffer !== "undefined")
        return Buffer.from(b64, "base64").toString("utf-8")
    const binary = (globalThis as any).atob(b64)
    const len = binary.length
    const bytes = new Uint8Array(len)
    for (let i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i)
    return new TextDecoder().decode(bytes)
}

/**
 * Cookie ヘッダ文字列をパースしてキー→値のマップを返す。
 *
 * 入力:
 * - `header` - HTTP の `Cookie` ヘッダ値（例: "a=1; b=2"）。空文字列可。
 * 処理:
 * - セミコロンで分割し、各エントリを trim、`=` でキーと値に分ける。
 * - 値は `decodeURIComponent` でデコードする。
 * 戻り値:
 * - 各 cookie 名をキー、対応する値を値とするオブジェクト。ヘッダが空なら空オブジェクトを返す。
 */
export function parseCookies(header = ""): Record<string, string> {
    if (!header) return {}
    return header
        .split(";")
        .map(s => s.trim())
        .filter(Boolean)
        .reduce((acc: Record<string, string>, cur) => {
            const idx = cur.indexOf("=")
            if (idx === -1) return acc
            const k = cur.slice(0, idx)
            const v = cur.slice(idx + 1)
            acc[k] = decodeURIComponent(v)
            return acc
        }, {})
}

/**
 * 指定した名前の cookie 値を `Cookie` ヘッダ文字列から取得する。
 *
 * 入力:
 * - `header` - HTTP の `Cookie` ヘッダ値。
 * - `name` - 取得したい cookie 名。
 * 処理:
 * - `parseCookies` を呼んでパース後、指定キーの値を返す。
 * 戻り値:
 * - 見つかれば値（デコード済）、見つからなければ `undefined`。
 */
export function getCookieFromHeader(
    header = "",
    name: string,
): string | undefined {
    return parseCookies(header)[name]
}

/**
 * Base64 エンコードされた JSON 文字列を復号してパースする（内部ユーティリティ）。
 *
 * 入力:
 * - `raw` - base64 でエンコードされた JSON 文字列。
 * 処理:
 * - base64 → UTF-8 にデコードし、`JSON.parse` する。
 * 例外:
 * - パースに失敗した場合は `Error('invalid session cookie')` を投げる。
 * 戻り値:
 * - JSON をパースしたオブジェクト（型は任意）。
 */
function decodeBase64Json(raw: string) {
    try {
        const decoded = decodeBase64Utf8(raw)
        return JSON.parse(decoded)
    } catch (e) {
        throw new Error("invalid session cookie")
    }
}

/**
 * API ハンドラ内で Request から atp_session をパースして session と service を取得する。
 *
 * 入力:
 * - `request` - サーバー側の `Request` オブジェクト（`headers` を参照する）。
 * 処理:
 * - `Cookie` ヘッダから `atp_session` を取得。
 * - 取得できなければ `Error('not authenticated')` を投げる。
 * - `atp_session` は base64 エンコードされた JSON としてデコードし、`session` と `service` を取り出す。
 * - `service` がなければ `process.env.DEFAULT_ATP_SERVICE`、さらに無ければ `https://bsky.social` をデフォルトとする。
 * 例外:
 * - cookie が無い場合は `Error('not authenticated')`。
 * - デコード/パースに失敗した場合は `Error('invalid session cookie')`。
 * 戻り値:
 * - `{ session, service }` オブジェクト。
 */
export function parseSessionFromRequest(request: Request) {
    const cookieHeader = request.headers.get("cookie") || ""
    const raw = getCookieFromHeader(cookieHeader, SESSION_COOKIE_NAME)
    if (!raw) {
        return { session: undefined, service: undefined }
    }
    const parsed = decodeBase64Json(raw)
    const session = (parsed as any).session ?? parsed
    const service = parsed.service ?? atpService
    return { session, service }
}

/**
 * セッション情報を `Set-Cookie` ヘッダ文字列に変換する。
 *
 * 入力:
 * - `payload` - cookie に格納したい任意のオブジェクト（通常は `{ session, service }`）。
 * - `opts` - cookie 属性の制御オプション（`maxAge`, `path`, `httpOnly`, `sameSite`, `secure`）。
 * 処理:
 * - `payload` を JSON にして base64 エンコードし、`atp_session=<val>` として設定する。
 * - `Path`, `Max-Age`, `HttpOnly`, `SameSite`, `Secure` 等の属性を付与する。
 * 戻り値:
 * - `Set-Cookie` ヘッダにそのまま入れられる単一の文字列。
 */
export function makeSessionSetCookie(
    payload: any,
    opts?: {
        maxAge?: number
        path?: string
    },
) {
    const cookieVal = encodeBase64Utf8(JSON.stringify(payload))
    const parts: string[] = []
    const secure = process.env.PUBLIC_NODE_ENV === "production"

    parts.push(`${SESSION_COOKIE_NAME}=${cookieVal}`)
    parts.push(`Path=${opts?.path ?? "/"}`)
    parts.push(`Max-Age=${opts?.maxAge ?? 60 * 60 * 24 * 7}`)
    parts.push("HttpOnly")
    parts.push(`SameSite=Strict`)

    if (secure) parts.push("Secure")
    return parts.join("; ")
}

export const SESSION_COOKIE_NAME = "atp_session"
export const ACCOUNTS_COOKIE_NAME = "atp_accounts"

/**
 * `atp_accounts` プールに保持できる非アクティブアカウント数の上限。
 * アクティブな1件と合わせて、複数アカウント機能全体で扱える最大アカウント数は `MAX_POOLED_ACCOUNTS + 1` になる。
 * Cookie サイズ上限（ブラウザ/Cloudflare Workers のヘッダサイズ制約）を踏まえた保守的な値。
 */
export const MAX_POOLED_ACCOUNTS = 4

/**
 * `atp_accounts` プールに保持する非アクティブアカウント1件分の情報。
 */
export type PooledAccount = {
    did: string
    handle: string
    service: string
    session: any
    addedAt: string
}

/**
 * `PooledAccount` として妥当な最小要件を満たしているかを検証する（内部ユーティリティ）。
 *
 * Input:
 * - `value`: `atp_accounts` cookie を復号した JSON 配列の要素候補
 *
 * Output:
 * - 必須フィールドを満たしていれば `true`
 */
function isPooledAccount(value: unknown): value is PooledAccount {
    if (typeof value !== "object" || value === null) return false
    const record = value as Record<string, unknown>
    return (
        typeof record.did === "string" &&
        typeof record.handle === "string" &&
        typeof record.service === "string" &&
        typeof record.addedAt === "string" &&
        record.session !== undefined
    )
}

/**
 * API ハンドラ内で Request から `atp_accounts` をパースし、プール中のアカウント一覧を取得する。
 *
 * 処理の趣旨:
 * - `atp_session` と異なり、cookie が無い/壊れている場合はエラーにせず空配列にフォールバックする
 *   （プールが空＝アクティブアカウントのみ、という自然な状態のため）。
 *
 * Input:
 * - `request`: サーバー側の `Request` オブジェクト
 *
 * Output:
 * - `PooledAccount` の配列（cookie が無い/不正な場合は空配列）
 */
export function parseAccountsFromRequest(request: Request): PooledAccount[] {
    const cookieHeader = request.headers.get("cookie") || ""
    const raw = getCookieFromHeader(cookieHeader, ACCOUNTS_COOKIE_NAME)
    if (!raw) return []

    try {
        const parsed = decodeBase64Json(raw)
        if (!Array.isArray(parsed)) return []
        return parsed.filter(isPooledAccount)
    } catch {
        return []
    }
}

/**
 * 指定した cookie を即時失効させる `Set-Cookie` ヘッダ文字列を生成する。
 *
 * 処理の趣旨:
 * - ログアウトや `atp_accounts` を空にする際、値を空にした上で `Max-Age=0` を指定し、
 *   `makeSessionSetCookie` / `makeAccountsSetCookie` と同じ cookie 属性（`HttpOnly` 等）で失効させる。
 *
 * Input:
 * - `name`: 失効させる cookie 名
 * - `path`: cookie の `Path` 属性（既定は `/`）
 *
 * Output:
 * - `Set-Cookie` ヘッダにそのまま入れられる単一の文字列
 */
export function makeClearSetCookie(name: string, path = "/"): string {
    const parts: string[] = []
    const secure = process.env.PUBLIC_NODE_ENV === "production"

    parts.push(`${name}=`)
    parts.push(`Path=${path}`)
    parts.push("Max-Age=0")
    parts.push("HttpOnly")
    parts.push("SameSite=Strict")
    if (secure) parts.push("Secure")
    return parts.join("; ")
}

/**
 * プール中のアカウント一覧を `atp_accounts` の `Set-Cookie` ヘッダ文字列に変換する。
 *
 * 処理の趣旨:
 * - 空配列を渡した場合はプールが空であることを示すため、`makeClearSetCookie` で cookie 自体を失効させる。
 *
 * Input:
 * - `accounts`: 保存したいプールアカウント一覧
 * - `opts`: cookie 属性の制御オプション（`maxAge`, `path`）
 *
 * Output:
 * - `Set-Cookie` ヘッダにそのまま入れられる単一の文字列
 */
export function makeAccountsSetCookie(
    accounts: PooledAccount[],
    opts?: {
        maxAge?: number
        path?: string
    },
): string {
    if (accounts.length === 0) {
        return makeClearSetCookie(ACCOUNTS_COOKIE_NAME, opts?.path)
    }

    const cookieVal = encodeBase64Utf8(JSON.stringify(accounts))
    const parts: string[] = []
    const secure = process.env.PUBLIC_NODE_ENV === "production"

    parts.push(`${ACCOUNTS_COOKIE_NAME}=${cookieVal}`)
    parts.push(`Path=${opts?.path ?? "/"}`)
    parts.push(`Max-Age=${opts?.maxAge ?? 60 * 60 * 24 * 7}`)
    parts.push("HttpOnly")
    parts.push(`SameSite=Strict`)

    if (secure) parts.push("Secure")
    return parts.join("; ")
}

/**
 * `atp_session` 相当のセッション情報を `PooledAccount` へ変換する（内部ユーティリティ）。
 *
 * Input:
 * - `session`: `{ did, handle, ... }` を含むセッションオブジェクト
 * - `service`: 対応する atproto service エンドポイント
 *
 * Output:
 * - プール保存用の `PooledAccount`
 */
export function toPooledAccount(session: any, service: string): PooledAccount {
    return {
        did: session.did,
        handle: session.handle,
        service,
        session,
        addedAt: new Date().toISOString(),
    }
}

/**
 * プール配列へアカウントを追加/更新する（同一 `did` は上書き）。
 *
 * Input:
 * - `pool`: 既存のプール一覧
 * - `account`: 追加/更新したいアカウント
 *
 * Output:
 * - 更新後のプール一覧（`account` は末尾に配置）
 */
export function upsertPooledAccount(
    pool: PooledAccount[],
    account: PooledAccount,
): PooledAccount[] {
    return [...pool.filter(item => item.did !== account.did), account]
}
