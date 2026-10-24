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
 */

import type { AtpSessionData } from "@atproto/api"
import type { EcPrivateJwk } from "@/lib/oauth/jose"
import { atpService } from "../../env"

// Cloudflare Workers 環境では Node の `Buffer` が存在しないため
// Web 標準 API (TextEncoder/TextDecoder + atob/btoa) を使って
// UTF-8 対応の base64 encode/decode を行うユーティリティを提供する。
export function encodeBase64Utf8(str: string) {
    if (typeof Buffer !== "undefined")
        return Buffer.from(str).toString("base64")
    const bytes = new TextEncoder().encode(str)
    let binary = ""
    for (let i = 0; i < bytes.length; i++)
        binary += String.fromCharCode(bytes[i])
    return (globalThis as any).btoa(binary)
}

export function decodeBase64Utf8(b64: string) {
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

export const SESSION_COOKIE_NAME = "atp_session"

/**
 * `atp_account_<n>` の枠の数（プールに保持できる非アクティブアカウント数の上限）。
 * アクティブな1件と合わせて、複数アカウント機能全体で扱える最大アカウント数は `MAX_POOLED_ACCOUNTS + 1` になる。
 * 1リクエストの Cookie ヘッダーの大きさ（ブラウザ/Cloudflare Workers のヘッダサイズ制約）を踏まえた保守的な値。
 */
export const MAX_POOLED_ACCOUNTS = 4

/** プールの枠の cookie 名 */
const accountCookieName = (index: number): string => `atp_account_${index}`

/** アプリパスワードのセッション（`@atproto/api` の `AtpAgent` のセッション） */
export type PasswordSession = {
    kind: "password"
    session: AtpSessionData
    service: string
}

/** OAuth のセッションのトークンと、それを使うための認可サーバーの情報 */
export type OAuthTokens = {
    accessToken: string
    /** アクセストークンの期限（UNIX 秒） */
    expiresAt: number
    refreshToken: string
    /** トークンが結び付いた DPoP の秘密鍵 */
    dpopJwk: EcPrivateJwk
    issuer: string
    tokenEndpoint: string
    revocationEndpoint?: string
    clientId: string
}

/** OAuth のセッション */
export type OAuthSession = {
    kind: "oauth"
    did: string
    handle: string
    /** アカウントの PDS の URL */
    pds: string
    oauth: OAuthTokens
}

/** cookie に保持するセッション */
export type StoredSession = PasswordSession | OAuthSession

/** プールに保持する非アクティブアカウント1件分の情報 */
export type PooledAccount = StoredSession & { addedAt: string }

/**
 * セッションのアカウントの識別子とハンドルを返す。
 *
 * 例: `sessionIdentity({ kind: "oauth", did: "did:plc:a", handle: "a.test", ... })` → `{ did: "did:plc:a", handle: "a.test" }`
 */
export const sessionIdentity = (
    s: StoredSession,
): { did: string; handle: string } =>
    s.kind === "oauth"
        ? { did: s.did, handle: s.handle }
        : { did: s.session.did, handle: s.session.handle }

const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === "object" && value !== null

/**
 * 復号した JSON を `StoredSession` として読む（内部ユーティリティ）。
 *
 * 想定する入力形状(最小要件):
 * - OAuth: `{ kind: "oauth", did, handle, pds, oauth: { accessToken, expiresAt, refreshToken, dpopJwk, issuer, tokenEndpoint, clientId } }`
 * - アプリパスワード: `{ kind?: "password", session: { did, handle, ... }, service? }`（`kind` の無い以前の形式を含む）
 *
 * Output: セッション。形が違えば undefined
 */
const toStoredSession = (value: unknown): StoredSession | undefined => {
    if (!isRecord(value)) return undefined
    if (value.kind === "oauth") {
        const o = value.oauth
        if (
            typeof value.did !== "string" ||
            typeof value.handle !== "string" ||
            typeof value.pds !== "string" ||
            !isRecord(o) ||
            typeof o.accessToken !== "string" ||
            typeof o.expiresAt !== "number" ||
            typeof o.refreshToken !== "string" ||
            !isRecord(o.dpopJwk) ||
            typeof o.issuer !== "string" ||
            typeof o.tokenEndpoint !== "string" ||
            typeof o.clientId !== "string"
        ) {
            return undefined
        }
        return value as unknown as OAuthSession
    }
    if (value.kind !== undefined && value.kind !== "password") return undefined
    const session = value.session
    if (
        !isRecord(session) ||
        typeof session.did !== "string" ||
        typeof session.handle !== "string"
    ) {
        return undefined
    }
    return {
        kind: "password",
        session: session as unknown as AtpSessionData,
        service: typeof value.service === "string" ? value.service : atpService,
    }
}

/**
 * Request から `atp_session` を復号して、アクティブのセッションを取得する。
 *
 * Input:
 * - `request` - サーバー側の `Request` オブジェクト（`headers` を参照する）。
 *
 * Output:
 * - セッション。cookie が無い・形が違うときは undefined
 *
 * 例外:
 * - base64 か JSON として壊れているときは `Error('invalid session cookie')`（呼び出し側で 500 にする）。
 *
 * 例:
 * - 入力: `atp_session=<{ kind: "oauth", did, ... } の base64>` → 出力: OAuth のセッション
 */
export function parseSessionFromRequest(
    request: Request,
): StoredSession | undefined {
    const cookieHeader = request.headers.get("cookie") || ""
    const raw = getCookieFromHeader(cookieHeader, SESSION_COOKIE_NAME)
    if (!raw) return undefined
    return toStoredSession(decodeBase64Json(raw))
}

/**
 * cookie の共通の属性を付けた `Set-Cookie` の値を作る（内部ユーティリティ）。
 * 本番のみ `Secure` を付ける（手元の http の確認環境でも cookie を使えるようにするため）。
 */
const buildSetCookie = (
    name: string,
    value: string,
    opts?: { maxAge?: number; path?: string },
): string => {
    const parts: string[] = []
    parts.push(`${name}=${value}`)
    parts.push(`Path=${opts?.path ?? "/"}`)
    parts.push(`Max-Age=${opts?.maxAge ?? 60 * 60 * 24 * 7}`)
    parts.push("HttpOnly")
    parts.push("SameSite=Strict")
    if (process.env.PUBLIC_NODE_ENV === "production") parts.push("Secure")
    return parts.join("; ")
}

/**
 * アクティブのセッションを `Set-Cookie` ヘッダ文字列に変換する。
 *
 * Input:
 * - `s` - 保持するセッション
 * - `opts` - cookie 属性の制御オプション（`maxAge`, `path`）。既定は `Path=/`・7日
 *
 * Output:
 * - `Set-Cookie` ヘッダにそのまま入れられる単一の文字列（`HttpOnly`・`SameSite=Strict`、本番のみ `Secure`）
 */
export function makeSessionSetCookie(
    s: StoredSession,
    opts?: { maxAge?: number; path?: string },
): string {
    return buildSetCookie(
        SESSION_COOKIE_NAME,
        encodeBase64Utf8(JSON.stringify(s)),
        opts,
    )
}

/**
 * Request から `atp_account_<n>` を枠の番号順に読み、プール中のアカウント一覧を取得する。
 *
 * 処理の趣旨:
 * - `atp_session` と異なり、壊れている枠はエラーにせず飛ばす
 *   （プールが空＝アクティブアカウントのみ、という自然な状態のため）。
 *
 * Input:
 * - `request`: サーバー側の `Request` オブジェクト
 *
 * Output:
 * - `PooledAccount` の配列（cookie が無い/不正な枠は含めない）
 */
export function parseAccountsFromRequest(request: Request): PooledAccount[] {
    const cookies = parseCookies(request.headers.get("cookie") || "")
    const pool: PooledAccount[] = []
    for (let index = 0; index < MAX_POOLED_ACCOUNTS; index++) {
        const raw = cookies[accountCookieName(index)]
        if (!raw) continue
        try {
            const parsed: unknown = decodeBase64Json(raw)
            const stored = toStoredSession(parsed)
            if (!stored || !isRecord(parsed)) continue
            pool.push({
                ...stored,
                addedAt:
                    typeof parsed.addedAt === "string"
                        ? parsed.addedAt
                        : new Date(0).toISOString(),
            })
        } catch {
            // 壊れた枠は飛ばす
        }
    }
    return pool
}

/**
 * 指定した cookie を即時失効させる `Set-Cookie` ヘッダ文字列を生成する。
 *
 * 処理の趣旨:
 * - ログアウトやプールの枠を空ける際、値を空にした上で `Max-Age=0` を指定し、
 *   `makeSessionSetCookie` と同じ cookie 属性（`HttpOnly` 等）で失効させる。
 *
 * Input:
 * - `name`: 失効させる cookie 名
 * - `path`: cookie の `Path` 属性（既定は `/`）
 *
 * Output:
 * - `Set-Cookie` ヘッダにそのまま入れられる単一の文字列
 */
export function makeClearSetCookie(name: string, path = "/"): string {
    return buildSetCookie(name, "", { maxAge: 0, path })
}

/**
 * プール中のアカウント一覧を、4つの枠の `Set-Cookie` ヘッダ文字列に変換する。
 *
 * 処理の趣旨:
 * - 先頭から順に枠へ入れ、空いた枠は `makeClearSetCookie` で失効させる（前の状態の枠を残さないため）。
 *
 * Input:
 * - `accounts`: 保存したいプールアカウント一覧（`MAX_POOLED_ACCOUNTS` 件まで）
 * - `opts`: cookie 属性の制御オプション（`maxAge`, `path`）
 *
 * Output:
 * - 4件の `Set-Cookie` ヘッダ文字列
 *
 * 例:
 * - 入力: 2件 → 出力: `atp_account_0`・`atp_account_1` の設定と、`atp_account_2`・`atp_account_3` の失効
 */
export function makeAccountsSetCookies(
    accounts: PooledAccount[],
    opts?: { maxAge?: number; path?: string },
): string[] {
    const cookies: string[] = []
    for (let index = 0; index < MAX_POOLED_ACCOUNTS; index++) {
        const account = accounts[index]
        cookies.push(
            account
                ? buildSetCookie(
                      accountCookieName(index),
                      encodeBase64Utf8(JSON.stringify(account)),
                      opts,
                  )
                : makeClearSetCookie(accountCookieName(index), opts?.path),
        )
    }
    return cookies
}

/**
 * セッションを `PooledAccount` へ変換する。
 *
 * Input: `s`: プールへ退避するセッション
 * Output: プール保存用の `PooledAccount`（退避した時刻を付ける）
 */
export function toPooledAccount(s: StoredSession): PooledAccount {
    return { ...s, addedAt: new Date().toISOString() }
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
    const { did } = sessionIdentity(account)
    return [...pool.filter(item => sessionIdentity(item).did !== did), account]
}

/**
 * 新しいセッションをアクティブにしたときの、プールの一覧を決める（追加ログイン・OAuth のログインで共通）。
 *
 * 処理の趣旨:
 * - 新しいアカウントがプールにあれば、アクティブへ昇格させるため除く。
 * - 別のアカウントがアクティブなら、そのセッションをプールへ退避する。プールが上限なら null。
 * - 同じアカウントでの再ログインは、トークンの更新とみなして退避しない。
 *
 * Input:
 * - `current`: 現在のアクティブのセッション（無ければ undefined）
 * - `pool`: 現在のプール
 * - `incoming`: 新しくアクティブにするセッション
 *
 * Output: 新しいプール。上限で退避できなければ null
 *
 * 例:
 * - 入力: `(A, [], B)` → 出力: `[A]`
 * - 入力: `(A, [C, D, E, F], B)` → 出力: `null`
 */
export function admitSession(
    current: StoredSession | undefined,
    pool: PooledAccount[],
    incoming: StoredSession,
): PooledAccount[] | null {
    const { did } = sessionIdentity(incoming)
    const rest = pool.filter(account => sessionIdentity(account).did !== did)
    if (!current || sessionIdentity(current).did === did) return rest
    if (rest.length >= MAX_POOLED_ACCOUNTS) return null
    return upsertPooledAccount(rest, toPooledAccount(current))
}
