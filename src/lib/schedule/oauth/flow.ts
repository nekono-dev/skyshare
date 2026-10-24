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
 *
 * 実装上の制約:
 * - Cron の実行からも使うため、atproto のライブラリを読み込まず WebCrypto と fetch だけを使う。
 * - トークン・鍵・応答の本文をログに出さない。
 */
import type { ScheduleEnv } from "../cfTypes"
import { saveCredential, saveOAuthState, takeOAuthState } from "../store"
import {
    type ClientKey,
    OAUTH_SCOPE,
    clientAssertionParams,
    clientIdFor,
    loadClientKey,
    redirectUriFor,
} from "./client"
import { type OAuthCredential, serializeCredential } from "./storedCredential"
import { discoverAuthorizationServer, resolvePdsUrl } from "./discovery"
import { type DpopSession, createDpopSession } from "./dpop"
import {
    type EcPrivateJwk,
    generateEcJwk,
    isEcPrivateJwk,
    randomString,
    sha256Base64url,
} from "./jose"
import { postForm } from "./tokenRequest"

type Env = Pick<ScheduleEnv, "DB" | "SCHEDULE_ENC_KEY" | "SCHEDULE_OAUTH_KEY">

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

/** ログに出す例外の種類（メッセージは URL などを含みうるため出さない） */
const errorName = (err: unknown): string =>
    err instanceof Error ? err.name : typeof err

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
    const client = await loadClientKey(env.SCHEDULE_OAUTH_KEY)
    if (!client) return { ok: false, status: 500, code: "OAuthNotConfigured" }
    const pdsUrl = await resolvePdsUrl(input.did, fetchImpl)
    if (!pdsUrl) return { ok: false, status: 502 }
    const as = await discoverAuthorizationServer(pdsUrl, fetchImpl)
    if (!as) return { ok: false, status: 502 }

    const clientId = clientIdFor(input.origin)
    const dpopJwk = await generateEcJwk()
    const dpop = await createDpopSession(dpopJwk)
    const state = randomString()
    const verifier = randomString(32)

    let res: Response | null
    try {
        res = await postForm({
            url: as.parEndpoint,
            dpop,
            now: input.now,
            fetchImpl,
            params: async () => ({
                ...(await clientAssertionParams(
                    client,
                    clientId,
                    as.issuer,
                    input.now,
                )),
                response_type: "code",
                redirect_uri: redirectUriFor(input.origin),
                scope: OAUTH_SCOPE,
                state,
                code_challenge: await sha256Base64url(verifier),
                code_challenge_method: "S256",
                login_hint: input.did,
            }),
        })
    } catch (err) {
        console.error(`oauth start: PAR unreachable (${errorName(err)})`)
        return { ok: false, status: 502 }
    }
    if (!res || !res.ok) {
        console.error(`oauth start: PAR ${res?.status ?? "none"}`)
        return { ok: false, status: 502 }
    }
    let requestUri: unknown
    try {
        requestUri = ((await res.json()) as { request_uri?: unknown })
            .request_uri
    } catch {
        requestUri = undefined
    }
    if (typeof requestUri !== "string") return { ok: false, status: 502 }

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
    const url = new URL(as.authorizationEndpoint)
    url.searchParams.set("client_id", clientId)
    url.searchParams.set("request_uri", requestUri)
    return { ok: true, url: url.toString() }
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
    const client = await loadClientKey(env.SCHEDULE_OAUTH_KEY)
    if (!client) return { ok: false, code: "NotConfigured" }

    const dpop = await createDpopSession(pending.dpopJwk)
    let res: Response | null
    try {
        res = await postForm({
            url: pending.tokenEndpoint,
            dpop,
            now: input.now,
            fetchImpl,
            params: async () => ({
                ...(await clientAssertionParams(
                    client,
                    pending.clientId,
                    pending.issuer,
                    input.now,
                )),
                grant_type: "authorization_code",
                code: query.code!,
                redirect_uri: redirectUriFor(input.origin),
                code_verifier: pending.verifier,
            }),
        })
    } catch (err) {
        console.error(`oauth complete: token unreachable (${errorName(err)})`)
        return { ok: false, code: "TokenFailed" }
    }
    if (!res || !res.ok) {
        console.error(`oauth complete: token ${res?.status ?? "none"}`)
        return { ok: false, code: "TokenFailed" }
    }
    const token = (await res.json().catch(() => ({}))) as {
        sub?: unknown
        refresh_token?: unknown
        token_type?: unknown
    }
    if (token.sub !== input.did) return { ok: false, code: "AccountMismatch" }
    if (
        typeof token.refresh_token !== "string" ||
        typeof token.token_type !== "string" ||
        token.token_type.toLowerCase() !== "dpop"
    ) {
        return { ok: false, code: "TokenFailed" }
    }

    const credential: OAuthCredential = {
        v: 1,
        clientId: pending.clientId,
        refreshToken: token.refresh_token,
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
export type RefreshFailure =
    | "Expired"
    | "RateLimited"
    | "Transient"
    | "BudgetExceeded"
    | "Invalid"
    | "NotConfigured"

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
    env: Pick<ScheduleEnv, "SCHEDULE_OAUTH_KEY">,
    input: {
        did: string
        credential: OAuthCredential
        now: number
        onRequest?: () => boolean
    },
    fetchImpl: typeof fetch = fetch,
): Promise<RefreshResult> => {
    const client: ClientKey | null = await loadClientKey(env.SCHEDULE_OAUTH_KEY)
    if (!client) return { ok: false, kind: "NotConfigured" }
    const { credential } = input
    const dpop = await createDpopSession(credential.dpopJwk)
    let res: Response | null
    try {
        res = await postForm({
            url: credential.tokenEndpoint,
            dpop,
            now: input.now,
            fetchImpl,
            onRequest: input.onRequest,
            params: async () => ({
                ...(await clientAssertionParams(
                    client,
                    credential.clientId,
                    credential.issuer,
                    input.now,
                )),
                grant_type: "refresh_token",
                refresh_token: credential.refreshToken,
            }),
        })
    } catch {
        return { ok: false, kind: "Transient" }
    }
    if (!res) return { ok: false, kind: "BudgetExceeded" }
    if (res.status === 429) return { ok: false, kind: "RateLimited" }
    if (res.status >= 500) return { ok: false, kind: "Transient" }
    const body = (await res.json().catch(() => ({}))) as {
        error?: unknown
        access_token?: unknown
        refresh_token?: unknown
        sub?: unknown
    }
    if (!res.ok) {
        // 更新用トークンの失効・取消は、利用者が認可し直すまで回復しない
        return {
            ok: false,
            kind: body.error === "invalid_grant" ? "Expired" : "Invalid",
        }
    }
    if (
        typeof body.access_token !== "string" ||
        typeof body.refresh_token !== "string" ||
        body.sub !== input.did
    ) {
        return { ok: false, kind: "Invalid" }
    }
    return {
        ok: true,
        accessToken: body.access_token,
        credential: { ...credential, refreshToken: body.refresh_token },
        dpop,
    }
}

/**
 * 更新用トークンを認可サーバーで取り消す。失敗しても例外を投げない（保管の削除は呼び出し側が行う）。
 */
export const revokeCredential = async (
    env: Pick<ScheduleEnv, "SCHEDULE_OAUTH_KEY">,
    credential: OAuthCredential,
    now: number,
    fetchImpl: typeof fetch = fetch,
): Promise<void> => {
    if (!credential.revocationEndpoint) return
    const client = await loadClientKey(env.SCHEDULE_OAUTH_KEY)
    if (!client) return
    try {
        const dpop = await createDpopSession(credential.dpopJwk)
        await postForm({
            url: credential.revocationEndpoint,
            dpop,
            now,
            fetchImpl,
            params: async () => ({
                ...(await clientAssertionParams(
                    client,
                    credential.clientId,
                    credential.issuer,
                    now,
                )),
                token: credential.refreshToken,
                token_type_hint: "refresh_token",
            }),
        })
    } catch (err) {
        console.warn(`oauth revoke: unreachable (${errorName(err)})`)
    }
}
