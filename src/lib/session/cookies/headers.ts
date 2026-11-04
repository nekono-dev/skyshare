/**
 * Cookie ヘッダの組み立て（`Set-Cookie` の値の作成）と、Request からの読み取り（`atp_session`・`atp_account_<n>`）。
 */

import {
    decodeBase64Json,
    encodeBase64Utf8,
    getCookieFromHeader,
    parseCookies,
} from "./codec"
import {
    SESSION_COOKIE_NAME,
    isRecord,
    toStoredSession,
    type PooledAccount,
    type StoredSession,
} from "./model"
import { MAX_POOLED_ACCOUNTS } from "./pool"

/** プールの枠の cookie 名 */
const accountCookieName = (index: number): string => `atp_account_${index}`

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
