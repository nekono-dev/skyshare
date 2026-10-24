/**
 * 認可サーバーへの、認可の要求の事前送信（PAR）・トークンの要求・取消。
 *
 * 責務と処理概要:
 * - PAR を送り、利用者を送る認可の画面の住所を作る。
 * - 認可コードの交換と、更新用トークンによる更新を同じ形で送り、応答を分類する。
 *   DPoP 型で、持ち主（`sub`）・アクセストークン・更新用トークンがそろう応答だけを成功とする。
 * - 更新用トークンを取り消す（失敗しても例外を投げない）。
 *
 * 実装上の制約:
 * - Cron の実行と全リクエストのミドルウェアから使うため、atproto のライブラリを読み込まず
 *   WebCrypto と fetch だけを使う。
 * - トークン・認可コード・鍵・応答の本文をログに出さない。ログに出すのは応答のステータスと例外の種類だけ。
 */
import { type ClientKey, clientAuthParams } from "./client"
import type { AuthorizationServer } from "./discovery"
import type { DpopSession } from "./dpop"
import { sha256Base64url } from "./jose"
import { postForm } from "./tokenRequest"

/** 得たトークンの組 */
export type TokenSet = {
    accessToken: string
    refreshToken: string
    /** アクセストークンの期限（UNIX 秒） */
    expiresAt: number
    /** トークンの持ち主の DID */
    sub: string
    scope: string
}

/** トークンの要求の失敗の分類 */
export type TokenFailure =
    | "Expired"
    | "RateLimited"
    | "Transient"
    | "BudgetExceeded"
    | "Invalid"
    | "NotConfigured"

export type TokenResult =
    { ok: true; tokens: TokenSet } | { ok: false; kind: TokenFailure }

/** トークンの要求の種類 */
export type TokenGrant =
    | {
          type: "authorization_code"
          code: string
          redirectUri: string
          verifier: string
      }
    | { type: "refresh_token"; refreshToken: string }

/** 応答に有効期限が無いときに見積もる秒数（atproto の参照実装の既定値） */
const DEFAULT_EXPIRES_IN = 3600

/** ログに出す例外の種類（メッセージは URL などを含みうるため出さない） */
const errorName = (err: unknown): string =>
    err instanceof Error ? err.name : typeof err

/**
 * 認可の要求を事前に送り（PAR）、認可の画面の住所を返す。
 *
 * Input:
 * - `as`: 認可サーバーの端点
 * - `client` / `clientId`: クライアントの秘密鍵（無ければ null）と識別子
 * - `redirectUri` / `scope` / `state` / `verifier`: 認可の要求の項目（verifier から S256 の challenge を作る）
 * - `loginHint`: 認可の画面で入力済みにするハンドルか DID（省略可）
 * - `dpop`: この認可で使う DPoP の鍵と nonce
 *
 * Output: 認可の画面の住所。秘密鍵が無ければ `NotConfigured`、通信の失敗や不正な応答は `Transient`
 *
 * 例:
 * - 出力: `{ ok: true, url: "https://bsky.social/oauth/authorize?client_id=...&request_uri=urn:..." }`
 */
export const pushAuthorizationRequest = async (
    input: {
        as: AuthorizationServer
        client: ClientKey | null
        clientId: string
        redirectUri: string
        scope: string
        state: string
        verifier: string
        loginHint?: string
        dpop: DpopSession
        now: number
    },
    fetchImpl: typeof fetch = fetch,
): Promise<
    | { ok: true; url: string }
    | { ok: false; kind: "NotConfigured" | "Transient" }
> => {
    const { as } = input
    const auth = await clientAuthParams(
        input.client,
        input.clientId,
        as.issuer,
        input.now,
    )
    if (!auth) return { ok: false, kind: "NotConfigured" }

    let res: Response | null
    try {
        res = await postForm({
            url: as.parEndpoint,
            dpop: input.dpop,
            now: input.now,
            fetchImpl,
            // クライアントの証明は使い捨てのため、やり直しのたびに作り直す
            params: async () => ({
                ...((await clientAuthParams(
                    input.client,
                    input.clientId,
                    as.issuer,
                    input.now,
                )) ?? auth),
                response_type: "code",
                redirect_uri: input.redirectUri,
                scope: input.scope,
                state: input.state,
                code_challenge: await sha256Base64url(input.verifier),
                code_challenge_method: "S256",
                ...(input.loginHint ? { login_hint: input.loginHint } : {}),
            }),
        })
    } catch (err) {
        console.error(`oauth PAR: unreachable (${errorName(err)})`)
        return { ok: false, kind: "Transient" }
    }
    if (!res || !res.ok) {
        console.error(`oauth PAR: ${res?.status ?? "none"}`)
        return { ok: false, kind: "Transient" }
    }
    let requestUri: unknown
    try {
        requestUri = ((await res.json()) as { request_uri?: unknown })
            .request_uri
    } catch {
        requestUri = undefined
    }
    if (typeof requestUri !== "string") return { ok: false, kind: "Transient" }

    const url = new URL(as.authorizationEndpoint)
    url.searchParams.set("client_id", input.clientId)
    url.searchParams.set("request_uri", requestUri)
    return { ok: true, url: url.toString() }
}

/**
 * トークンの応答の本文から、受け付けられるトークンの組を取り出す。
 *
 * 想定する入力形状(最小要件):
 * - `{ token_type: "DPoP", access_token, refresh_token, sub, scope?, expires_in? }`
 *
 * Output: トークンの組。種類が DPoP でない・項目が欠けるときは null
 */
const parseTokenSet = (body: unknown, now: number): TokenSet | null => {
    if (typeof body !== "object" || body === null) return null
    const b = body as Record<string, unknown>
    if (
        typeof b.token_type !== "string" ||
        b.token_type.toLowerCase() !== "dpop" ||
        typeof b.access_token !== "string" ||
        typeof b.refresh_token !== "string" ||
        typeof b.sub !== "string"
    ) {
        return null
    }
    const expiresIn =
        typeof b.expires_in === "number" && b.expires_in > 0
            ? b.expires_in
            : DEFAULT_EXPIRES_IN
    return {
        accessToken: b.access_token,
        refreshToken: b.refresh_token,
        expiresAt: now + expiresIn,
        sub: b.sub,
        scope: typeof b.scope === "string" ? b.scope : "",
    }
}

/**
 * トークンを要求する（認可コードの交換、または更新用トークンによる更新）。
 *
 * Input:
 * - `tokenEndpoint` / `issuer`: 認可サーバーのトークンの端点と識別子
 * - `client` / `clientId`: クライアントの秘密鍵（無ければ null）と識別子
 * - `grant`: 認可コードか更新用トークン
 * - `dpop`: 認可の開始時と同じ DPoP の鍵（トークンはこの鍵に結び付く）
 * - `onRequest`: 送る直前に呼ぶ（Cron の通信の予算の消費）。偽で送らない
 *
 * Output: トークンの組、または失敗の分類（分類の意味は設計の表のとおり）
 *
 * 例:
 * - 入力: `{ grant: { type: "refresh_token", refreshToken: "ref-..." }, ... }`
 * - 出力: `{ ok: true, tokens: { accessToken, refreshToken, expiresAt, sub, scope } }`
 */
export const requestTokens = async (
    input: {
        tokenEndpoint: string
        issuer: string
        client: ClientKey | null
        clientId: string
        grant: TokenGrant
        dpop: DpopSession
        now: number
        onRequest?: () => boolean
    },
    fetchImpl: typeof fetch = fetch,
): Promise<TokenResult> => {
    const firstAuth = await clientAuthParams(
        input.client,
        input.clientId,
        input.issuer,
        input.now,
    )
    if (!firstAuth) return { ok: false, kind: "NotConfigured" }
    const { grant } = input
    const grantParams: Record<string, string> =
        grant.type === "authorization_code"
            ? {
                  grant_type: "authorization_code",
                  code: grant.code,
                  redirect_uri: grant.redirectUri,
                  code_verifier: grant.verifier,
              }
            : { grant_type: "refresh_token", refresh_token: grant.refreshToken }

    let res: Response | null
    try {
        res = await postForm({
            url: input.tokenEndpoint,
            dpop: input.dpop,
            now: input.now,
            fetchImpl,
            onRequest: input.onRequest,
            // クライアントの証明は使い捨てのため、やり直しのたびに作り直す
            params: async () => ({
                ...((await clientAuthParams(
                    input.client,
                    input.clientId,
                    input.issuer,
                    input.now,
                )) ?? firstAuth),
                ...grantParams,
            }),
        })
    } catch (err) {
        console.error(`oauth token: unreachable (${errorName(err)})`)
        return { ok: false, kind: "Transient" }
    }
    if (!res) return { ok: false, kind: "BudgetExceeded" }
    if (res.status === 429) return { ok: false, kind: "RateLimited" }
    if (res.status >= 500) {
        console.error(`oauth token: ${res.status}`)
        return { ok: false, kind: "Transient" }
    }
    const body = (await res.json().catch(() => ({}))) as { error?: unknown }
    if (!res.ok) {
        console.warn(`oauth token: ${res.status}`)
        // 更新用トークンの失効・取消・認可コードの使用済みは、利用者が認可し直すまで回復しない
        return {
            ok: false,
            kind: body.error === "invalid_grant" ? "Expired" : "Invalid",
        }
    }
    const tokens = parseTokenSet(body, input.now)
    return tokens ? { ok: true, tokens } : { ok: false, kind: "Invalid" }
}

/**
 * 更新用トークンを認可サーバーで取り消す。端点が無い・秘密鍵が無い・通信が失敗しても例外を投げない。
 *
 * Input: 取消の端点・認可サーバーの識別子・クライアント・更新用トークン・DPoP の鍵
 * Output: なし
 */
export const revokeToken = async (
    input: {
        revocationEndpoint?: string
        issuer: string
        client: ClientKey | null
        clientId: string
        refreshToken: string
        dpop: DpopSession
        now: number
    },
    fetchImpl: typeof fetch = fetch,
): Promise<void> => {
    if (!input.revocationEndpoint) return
    const auth = await clientAuthParams(
        input.client,
        input.clientId,
        input.issuer,
        input.now,
    )
    if (!auth) return
    try {
        const res = await postForm({
            url: input.revocationEndpoint,
            dpop: input.dpop,
            now: input.now,
            fetchImpl,
            params: async () => ({
                ...((await clientAuthParams(
                    input.client,
                    input.clientId,
                    input.issuer,
                    input.now,
                )) ?? auth),
                token: input.refreshToken,
                token_type_hint: "refresh_token",
            }),
        })
        if (res && !res.ok) console.warn(`oauth revoke: ${res.status}`)
    } catch (err) {
        console.warn(`oauth revoke: unreachable (${errorName(err)})`)
    }
}
