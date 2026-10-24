/**
 * Bluesky の OAuth によるログインの開始と完了。
 *
 * 責務と処理概要:
 * - 開始: Bluesky の認可サーバー（`https://bsky.social`）へ、ユーザー名を渡さずに（再ログインではハンドルを
 *   入力済みの指定にして）ログインの権限で認可の要求を事前に送り（PAR）、認可の画面の住所を返す。
 *   照合に使う途中の状態（state・PKCE の verifier・DPoP の鍵など）は、完了の API だけに送る10分の
 *   HttpOnly の cookie に入れる。ログインの前は利用者を特定できないため、サーバーには保管しない。
 * - 完了: 途中の状態との state と発行元の一致を確かめて認可コードをトークンに替え、トークンの持ち主（`sub`）の
 *   PDS の認可サーバーが発行元と一致し、PDS がそのトークンで持ち主のセッションを返すことを確かめてから、
 *   OAuth のセッションを作る。プールへの退避と cookie の設定は、完了のハンドラが行う。
 *
 * 前提:
 * - ユーザー名を事前に渡さず発行元を固定して始めるため、持ち主の DID に対して発行元が正当な認可サーバーで
 *   あることを、DID ドキュメントの PDS から辿って確かめる（別の認可サーバーが発行した主張を受け付けない）。
 * - Bluesky の認可サーバーでログインできるのは、Bluesky がホスティングするアカウントだけである。
 *
 * 実装上の制約:
 * - atproto のライブラリを読み込まず、共通の OAuth のクライアント（`@/lib/oauth/*`）だけを使う。
 * - トークン・認可コード・鍵をログに出さない。
 */
import {
    SESSION_SCOPE,
    clientIdFor,
    loadClientKey,
    redirectUriFor,
} from "@/lib/oauth/client"
import {
    discoverAuthorizationServer,
    readAuthorizationServer,
    resolvePdsUrl,
} from "@/lib/oauth/discovery"
import { createDpopSession } from "@/lib/oauth/dpop"
import { getOAuthClientSecret } from "@/lib/oauth/env"
import {
    type EcPrivateJwk,
    generateEcJwk,
    isEcPrivateJwk,
    randomString,
} from "@/lib/oauth/jose"
import { isLoopbackClientId } from "@/lib/oauth/loopback"
import { createDpopFetch } from "@/lib/oauth/resourceFetch"
import { pushAuthorizationRequest, requestTokens } from "@/lib/oauth/token"
import {
    decodeBase64Utf8,
    encodeBase64Utf8,
    getCookieFromHeader,
    type OAuthSession,
} from "./cookies"

/** ログインの認可を受ける認可サーバー（Bluesky がホスティングするアカウントの共通の認可サーバー） */
export const SESSION_AUTHORIZATION_SERVER = "https://bsky.social"

/** 途中の状態の cookie */
const PENDING_COOKIE = "oauth_login_pending"

/** 途中の状態の cookie を送るパス（開始と完了の API に限る） */
const PENDING_COOKIE_PATH = "/v2/bsky/session/authorization/"

/** 認可の開始から完了までに許す秒数 */
const PENDING_MAX_AGE = 10 * 60

/** ログインの途中の状態 */
export type PendingLogin = {
    state: string
    verifier: string
    dpopJwk: EcPrivateJwk
    issuer: string
    tokenEndpoint: string
    revocationEndpoint?: string
    clientId: string
    redirectUri: string
}

/** ログインの完了の失敗の分類。画面の文言の選択に使う */
export type LoginFailure =
    | "Denied"
    | "StateInvalid"
    | "IssuerMismatch"
    | "TokenFailed"
    | "AccountUnverified"
    | "NotConfigured"

const cookieAttributes = (maxAge: number): string => {
    const parts = [
        `Path=${PENDING_COOKIE_PATH}`,
        `Max-Age=${maxAge}`,
        "HttpOnly",
        "SameSite=Strict",
    ]
    if (process.env.PUBLIC_NODE_ENV === "production") parts.push("Secure")
    return parts.join("; ")
}

/**
 * 途中の状態を入れる `Set-Cookie` の値。完了の API は同じサイトのページから呼ぶため、Strict で届く。
 *
 * 例: `pendingCookie(pending)` → `"oauth_login_pending=<base64>; Path=/v2/bsky/session/authorization/; Max-Age=600; HttpOnly; SameSite=Strict"`
 */
export const pendingCookie = (pending: PendingLogin): string =>
    `${PENDING_COOKIE}=${encodeBase64Utf8(JSON.stringify(pending))}; ${cookieAttributes(PENDING_MAX_AGE)}`

/** 途中の状態の cookie を消す `Set-Cookie` の値 */
export const clearPendingCookie = (): string =>
    `${PENDING_COOKIE}=; ${cookieAttributes(0)}`

/**
 * 要求の cookie から途中の状態を読む。
 *
 * 想定する入力形状(最小要件):
 * - `PendingLogin` の JSON の base64
 *
 * Output: 途中の状態。無い・壊れている・形が違うときは null
 */
export const readPendingCookie = (
    cookieHeader: string | null,
): PendingLogin | null => {
    const raw = getCookieFromHeader(cookieHeader ?? "", PENDING_COOKIE)
    if (!raw) return null
    try {
        const v = JSON.parse(decodeBase64Utf8(raw)) as Record<string, unknown>
        return typeof v.state === "string" &&
            typeof v.verifier === "string" &&
            isEcPrivateJwk(v.dpopJwk) &&
            typeof v.issuer === "string" &&
            typeof v.tokenEndpoint === "string" &&
            typeof v.clientId === "string" &&
            typeof v.redirectUri === "string"
            ? (v as unknown as PendingLogin)
            : null
    } catch {
        return null
    }
}

/**
 * ログインを開始する。
 *
 * Input:
 * - `origin`: 配信しているオリジン（クライアントの識別子と戻り先を決める）
 * - `loginHint`: 再ログインのとき、認可の画面で入力済みにするハンドル（省略可）
 * - `now`: 現在時刻（UNIX 秒）
 *
 * Output:
 * - 成功: 認可の画面の住所と、cookie に入れる途中の状態
 * - 失敗: 秘密鍵の未設定は 500、認可サーバーの探索・PAR の失敗は 502
 *
 * 例:
 * - 入力: `{ origin: "https://skyshare.example.com", now }`
 * - 出力: `{ ok: true, url: "https://bsky.social/oauth/authorize?...", pending }`
 */
export const startOAuthLogin = async (
    input: { origin: string; loginHint?: string; now: number },
    fetchImpl: typeof fetch = fetch,
): Promise<
    | { ok: true; url: string; pending: PendingLogin }
    | { ok: false; status: 500 | 502 }
> => {
    const clientId = clientIdFor(input.origin)
    const client = await loadClientKey(await getOAuthClientSecret())
    // 開発用の公開クライアントは秘密鍵を持たない
    if (!client && !isLoopbackClientId(clientId)) {
        console.error("oauth login: client key not configured")
        return { ok: false, status: 500 }
    }
    const as = await readAuthorizationServer(
        SESSION_AUTHORIZATION_SERVER,
        fetchImpl,
    )
    if (!as) return { ok: false, status: 502 }

    const dpopJwk = await generateEcJwk()
    const state = randomString()
    const verifier = randomString(32)
    const redirectUri = redirectUriFor(input.origin)
    const par = await pushAuthorizationRequest(
        {
            as,
            client,
            clientId,
            redirectUri,
            scope: SESSION_SCOPE,
            state,
            verifier,
            loginHint: input.loginHint,
            dpop: await createDpopSession(dpopJwk),
            now: input.now,
        },
        fetchImpl,
    )
    if (!par.ok) {
        return { ok: false, status: par.kind === "NotConfigured" ? 500 : 502 }
    }
    return {
        ok: true,
        url: par.url,
        pending: {
            state,
            verifier,
            dpopJwk,
            issuer: as.issuer,
            tokenEndpoint: as.tokenEndpoint,
            ...(as.revocationEndpoint
                ? { revocationEndpoint: as.revocationEndpoint }
                : {}),
            clientId,
            redirectUri,
        },
    }
}

/**
 * ログインを完了する（認可の画面からの戻り）。
 *
 * Input:
 * - `pending`: cookie から読んだ途中の状態（無ければ null）
 * - `query`: 戻りの項目（`code`・`state`・`iss`、拒否のときは `error`）
 * - `now`: 現在時刻（UNIX 秒）
 *
 * Output: OAuth のセッション、または失敗の分類（分類の意味は設計の表のとおり）
 *
 * 例:
 * - 入力: `{ pending, query: { code: "c", state: pending.state, iss: "https://bsky.social" }, now }`
 * - 出力: `{ ok: true, session: { kind: "oauth", did, handle, pds, oauth } }`
 */
export const completeOAuthLogin = async (
    input: {
        pending: PendingLogin | null
        query: { code?: string; state?: string; iss?: string; error?: string }
        now: number
    },
    fetchImpl: typeof fetch = fetch,
): Promise<
    { ok: true; session: OAuthSession } | { ok: false; code: LoginFailure }
> => {
    const { pending, query } = input
    if (query.error) return { ok: false, code: "Denied" }
    if (!pending || !query.code || query.state !== pending.state) {
        return { ok: false, code: "StateInvalid" }
    }
    if (query.iss !== pending.issuer) {
        return { ok: false, code: "IssuerMismatch" }
    }

    const client = await loadClientKey(await getOAuthClientSecret())
    const dpop = await createDpopSession(pending.dpopJwk)
    const result = await requestTokens(
        {
            tokenEndpoint: pending.tokenEndpoint,
            issuer: pending.issuer,
            client,
            clientId: pending.clientId,
            grant: {
                type: "authorization_code",
                code: query.code,
                redirectUri: pending.redirectUri,
                verifier: pending.verifier,
            },
            dpop,
            now: input.now,
        },
        fetchImpl,
    )
    if (!result.ok) {
        return {
            ok: false,
            code:
                result.kind === "NotConfigured"
                    ? "NotConfigured"
                    : "TokenFailed",
        }
    }
    const { tokens } = result

    // トークンの持ち主の PDS から辿った認可サーバーが、発行元と一致することを確かめる
    const pds = await resolvePdsUrl(tokens.sub, fetchImpl)
    if (!pds) return { ok: false, code: "AccountUnverified" }
    const as = await discoverAuthorizationServer(pds, fetchImpl)
    if (!as || as.issuer !== pending.issuer) {
        console.warn(
            "oauth login: issuer is not the account's authorization server",
        )
        return { ok: false, code: "AccountUnverified" }
    }

    // PDS がこのトークンで持ち主のセッションを返すことを確かめ、ハンドルを得る
    const fetchPds = createDpopFetch({
        pdsUrl: pds,
        accessToken: tokens.accessToken,
        dpop,
        now: () => input.now,
        fetchImpl,
    })
    let handle: unknown
    try {
        const res = await fetchPds("/xrpc/com.atproto.server.getSession")
        if (!res.ok) {
            console.warn(`oauth login: getSession ${res.status}`)
            return { ok: false, code: "AccountUnverified" }
        }
        const body = (await res.json()) as { did?: unknown; handle?: unknown }
        if (body.did !== tokens.sub)
            return { ok: false, code: "AccountUnverified" }
        handle = body.handle
    } catch {
        console.warn("oauth login: getSession unreachable")
        return { ok: false, code: "AccountUnverified" }
    }
    if (typeof handle !== "string")
        return { ok: false, code: "AccountUnverified" }

    return {
        ok: true,
        session: {
            kind: "oauth",
            did: tokens.sub,
            handle,
            pds,
            oauth: {
                accessToken: tokens.accessToken,
                expiresAt: tokens.expiresAt,
                refreshToken: tokens.refreshToken,
                dpopJwk: pending.dpopJwk,
                issuer: pending.issuer,
                tokenEndpoint: pending.tokenEndpoint,
                ...(pending.revocationEndpoint
                    ? { revocationEndpoint: pending.revocationEndpoint }
                    : {}),
                clientId: pending.clientId,
            },
        },
    }
}
