/**
 * 予約投稿の OAuth の認可の開始・完了と、Cron の実行でのトークンの更新・取消。
 *
 * 責務と処理概要:
 * - 開始: ログイン中のアカウントの DID から実際の PDS を解決し、PDS から認可サーバーを探し、PKCE と DPoP の鍵を作って
 *   認可の要求を事前に送り（PAR）、利用者を送る認可の画面の URL を返す。
 *   ユーザー名は入力させず、ログイン中のアカウントの DID を `login_hint` に入れる。
 * - 完了: 戻ってきた `state` を照合し、認可コードをトークンに替える。トークンの持ち主（`sub`）が
 *   ログイン中のアカウントと同じことを確かめてから、更新用トークンと DPoP の鍵を暗号化して保管する。
 * - 更新: Cron の実行の始めに、更新用トークンで新しいアクセストークンと更新用トークンを得る。
 * - 取消: 予約投稿を無効にしたとき、更新用トークンを認可サーバーで取り消す（失敗しても続ける）。
 * - PAR・トークンの要求・取消の送り方は、共通の OAuth のクライアント（`@/lib/oauth/token`）に委ねる。
 *
 * 実装上の制約:
 * - Cron の実行からも使うため、atproto のライブラリを読み込まず WebCrypto と fetch だけを使う。
 * - トークン・鍵・応答の本文をログに出さない。
 */
import type { ScheduleEnv } from "../cfTypes"
import { saveCredential, saveOAuthState, takeOAuthState } from "../store"
import {
    SCHEDULE_SCOPE,
    clientIdFor,
    loadClientKey,
    redirectUriFor,
} from "@/lib/oauth/client"
import { type OAuthCredential, serializeCredential } from "./storedCredential"
import {
    discoverAuthorizationServer,
    resolvePdsUrl,
} from "@/lib/oauth/discovery"
import { type DpopSession, createDpopSession } from "@/lib/oauth/dpop"
import {
    type EcPrivateJwk,
    generateEcJwk,
    isEcPrivateJwk,
    randomString,
} from "@/lib/oauth/jose"
import { isLoopbackClientId } from "@/lib/oauth/loopback"
import {
    type TokenFailure,
    pushAuthorizationRequest,
    requestTokens,
    revokeToken,
} from "@/lib/oauth/token"

type Env = Pick<ScheduleEnv, "DB" | "SCHEDULE_ENC_KEY" | "OAUTH_CLIENT_KEY">

/** 認可の途中で保つ状態 */
type PendingAuthorization = {
    verifier: string
    dpopJwk: EcPrivateJwk
    issuer: string
    tokenEndpoint: string
    revocationEndpoint?: string
    pdsUrl: string
    clientId: string
}

export type StartResult =
    | { ok: true; url: string }
    | { ok: false; status: 500 | 502; code?: "OAuthNotConfigured" }

/**
 * 認可を開始する。
 *
 * Input:
 * - `origin`: 配信しているオリジン（クライアントの識別子と戻り先を決める）
 * - `did`: ログイン中のアカウント
 *
 * Output: 利用者を送る認可の画面の URL。設定の不備は 500、認可サーバーの不調は 502
 */
export const startAuthorization = async (
    env: Env,
    input: { origin: string; did: string; now: number },
    fetchImpl: typeof fetch = fetch,
): Promise<StartResult> => {
    const clientId = clientIdFor(input.origin)
    const client = await loadClientKey(env.OAUTH_CLIENT_KEY)
    // 開発用の公開クライアントは秘密鍵を持たない
    if (!client && !isLoopbackClientId(clientId)) {
        return { ok: false, status: 500, code: "OAuthNotConfigured" }
    }
    const pdsUrl = await resolvePdsUrl(input.did, fetchImpl)
    if (!pdsUrl) return { ok: false, status: 502 }
    const as = await discoverAuthorizationServer(pdsUrl, fetchImpl)
    if (!as) return { ok: false, status: 502 }

    const dpopJwk = await generateEcJwk()
    const dpop = await createDpopSession(dpopJwk)
    const state = randomString()
    const verifier = randomString(32)

    const par = await pushAuthorizationRequest(
        {
            as,
            client,
            clientId,
            redirectUri: redirectUriFor(input.origin),
            scope: SCHEDULE_SCOPE,
            state,
            verifier,
            loginHint: input.did,
            dpop,
            now: input.now,
        },
        fetchImpl,
    )
    if (!par.ok) {
        return par.kind === "NotConfigured"
            ? { ok: false, status: 500, code: "OAuthNotConfigured" }
            : { ok: false, status: 502 }
    }

    const pending: PendingAuthorization = {
        verifier,
        dpopJwk,
        issuer: as.issuer,
        tokenEndpoint: as.tokenEndpoint,
        ...(as.revocationEndpoint
            ? { revocationEndpoint: as.revocationEndpoint }
            : {}),
        pdsUrl,
        clientId,
    }
    await saveOAuthState(
        env.DB,
        env.SCHEDULE_ENC_KEY,
        { state, did: input.did, data: JSON.stringify(pending) },
        input.now,
    )
    return { ok: true, url: par.url }
}

/** 認可の完了の失敗の分類。画面へ戻すときの理由に使う */
export type CompleteFailure =
    | "Denied"
    | "StateInvalid"
    | "IssuerMismatch"
    | "AccountMismatch"
    | "TokenFailed"
    | "NotConfigured"

export type CompleteResult = { ok: true } | { ok: false; code: CompleteFailure }

const parsePending = (text: string): PendingAuthorization | null => {
    try {
        const v = JSON.parse(text) as PendingAuthorization
        return typeof v.verifier === "string" &&
            isEcPrivateJwk(v.dpopJwk) &&
            typeof v.issuer === "string" &&
            typeof v.tokenEndpoint === "string" &&
            typeof v.pdsUrl === "string" &&
            typeof v.clientId === "string"
            ? v
            : null
    } catch {
        return null
    }
}

/**
 * 認可を完了する（認可の画面からの戻り）。
 *
 * Input:
 * - `did`: ログイン中のアカウント（認可を始めたアカウントと同じでなければならない）
 * - `query`: 戻りの URL のクエリ（`code`・`state`・`iss`、拒否のときは `error`）
 *
 * Output: 成功、または失敗の分類
 */
export const completeAuthorization = async (
    env: Env,
    input: {
        origin: string
        did: string
        now: number
        query: { code?: string; state?: string; iss?: string; error?: string }
    },
    fetchImpl: typeof fetch = fetch,
): Promise<CompleteResult> => {
    const { query } = input
    // 拒否されたときも state を消費して、使い回せないようにする
    const raw = query.state
        ? await takeOAuthState(
              env.DB,
              env.SCHEDULE_ENC_KEY,
              query.state,
              input.did,
              input.now,
          ).catch(() => null)
        : null
    if (query.error) return { ok: false, code: "Denied" }
    const pending = raw ? parsePending(raw) : null
    if (!pending || !query.code) return { ok: false, code: "StateInvalid" }
    if (query.iss !== pending.issuer) {
        return { ok: false, code: "IssuerMismatch" }
    }
    const client = await loadClientKey(env.OAUTH_CLIENT_KEY)
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
                redirectUri: redirectUriFor(input.origin),
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
    if (result.tokens.sub !== input.did) {
        return { ok: false, code: "AccountMismatch" }
    }

    const credential: OAuthCredential = {
        v: 1,
        clientId: pending.clientId,
        refreshToken: result.tokens.refreshToken,
        dpopJwk: pending.dpopJwk,
        issuer: pending.issuer,
        tokenEndpoint: pending.tokenEndpoint,
        ...(pending.revocationEndpoint
            ? { revocationEndpoint: pending.revocationEndpoint }
            : {}),
    }
    await saveCredential(
        env.DB,
        env.SCHEDULE_ENC_KEY,
        {
            did: input.did,
            service: pending.pdsUrl,
            token: serializeCredential(credential),
        },
        input.now,
        { authorized: true },
    )
    return { ok: true }
}

/** トークンの更新の失敗の分類 */
export type RefreshFailure = TokenFailure

export type RefreshResult =
    | {
          ok: true
          accessToken: string
          /** 回転した新しい更新用トークン。呼び出し側が投稿の前に保管する */
          credential: OAuthCredential
          dpop: DpopSession
      }
    | { ok: false; kind: RefreshFailure }

/**
 * 更新用トークンで、新しいアクセストークンと更新用トークンを得る。
 *
 * Input:
 * - `did`: 予約のアカウント（応答の `sub` と照合する）
 * - `onRequest`: 送る直前に呼ぶ（通信の予算の消費）。偽で送らない
 *
 * Output: アクセストークンと、DPoP の証明に使う状態と、更新後の認可の情報
 */
export const refreshTokens = async (
    env: Pick<ScheduleEnv, "OAUTH_CLIENT_KEY">,
    input: {
        did: string
        credential: OAuthCredential
        now: number
        onRequest?: () => boolean
    },
    fetchImpl: typeof fetch = fetch,
): Promise<RefreshResult> => {
    const client = await loadClientKey(env.OAUTH_CLIENT_KEY)
    const { credential } = input
    const dpop = await createDpopSession(credential.dpopJwk)
    const result = await requestTokens(
        {
            tokenEndpoint: credential.tokenEndpoint,
            issuer: credential.issuer,
            client,
            clientId: credential.clientId,
            grant: {
                type: "refresh_token",
                refreshToken: credential.refreshToken,
            },
            dpop,
            now: input.now,
            onRequest: input.onRequest,
        },
        fetchImpl,
    )
    if (!result.ok) return { ok: false, kind: result.kind }
    if (result.tokens.sub !== input.did) return { ok: false, kind: "Invalid" }
    return {
        ok: true,
        accessToken: result.tokens.accessToken,
        credential: { ...credential, refreshToken: result.tokens.refreshToken },
        dpop,
    }
}

/**
 * 更新用トークンを認可サーバーで取り消す。失敗しても例外を投げない（保管の削除は呼び出し側が行う）。
 */
export const revokeCredential = async (
    env: Pick<ScheduleEnv, "OAUTH_CLIENT_KEY">,
    credential: OAuthCredential,
    now: number,
    fetchImpl: typeof fetch = fetch,
): Promise<void> => {
    const client = await loadClientKey(env.OAUTH_CLIENT_KEY)
    const dpop = await createDpopSession(credential.dpopJwk)
    await revokeToken(
        {
            revocationEndpoint: credential.revocationEndpoint,
            issuer: credential.issuer,
            client,
            clientId: credential.clientId,
            refreshToken: credential.refreshToken,
            dpop,
            now,
        },
        fetchImpl,
    )
}
