/**
 * OAuth のセッションの再開・期限の前の更新・取消と、DPoP の nonce の持ち越し。
 *
 * 責務と処理概要:
 * - 期限の前の更新: アクセストークンの期限まで60秒を切ったときだけ、更新用トークンで新しいトークンを得る。
 *   毎回更新しないのは、並行するリクエストが同じ更新用トークンを使うと、認可サーバーが再利用とみなして
 *   セッション全体を失効させるためである（更新の頻度を、アクセストークンの寿命に1回へ抑える）。
 * - 再開: 更新したセッションで、DPoP つきの要求で動くエージェントを作る。応答の直前に、更新したときだけ
 *   セッションの cookie を、PDS の nonce が変わったときだけ nonce の cookie を返す。
 * - nonce の持ち越し: PDS は DPoP の証明に nonce を求めるため、最後に受け取った nonce を cookie に残し、
 *   次のリクエストの最初の要求に入れる（毎リクエストの最初の要求のやり直しを避ける）。
 * - 取消: ログアウトのとき、更新用トークンを認可サーバーで取り消す（失敗しても続ける）。
 *
 * 実装上の制約:
 * - 全リクエストで読み込まれるミドルウェアから読み込むため、`@atproto/*` を静的に読み込まない。
 *   エージェントの生成（`oauthAgent.ts`）は再開の時点で動的に読み込む。
 * - トークン・鍵をログに出さない。
 */
import type { Agent } from "@atproto/api"
import { loadClientKey } from "@/lib/oauth/client"
import { createDpopSession } from "@/lib/oauth/dpop"
import { getOAuthClientSecret } from "@/lib/oauth/env"
import { createDpopFetch } from "@/lib/oauth/resourceFetch"
import { requestTokens, revokeToken } from "@/lib/oauth/token"
import {
    getCookieFromHeader,
    makeSessionSetCookie,
    type OAuthSession,
} from "./cookies"

/** アクセストークンの期限までの残りがこの秒数を切ったら更新する */
export const REFRESH_MARGIN_SECONDS = 60

/** PDS の DPoP の nonce を持ち越す cookie */
const NONCE_COOKIE = "atp_dpop_nonce"

/** nonce の cookie を保つ秒数（nonce は数分で替わるため、長く保つ意味はない） */
const NONCE_MAX_AGE = 60 * 60 * 24

/** 再開・更新の失敗のときに返す HTTP の状態 */
export type ResumeFailureStatus = 401 | 429 | 500 | 502

/**
 * 要求の cookie から、持ち越した PDS の nonce を読む。
 *
 * Output: nonce を受け取った PDS のオリジンと nonce。無い・壊れているときは null
 *
 * 例: `readNonceCookie("atp_dpop_nonce=https%3A%2F%2Fpds.example%20n1")` → `{ origin: "https://pds.example", nonce: "n1" }`
 */
export const readNonceCookie = (
    cookieHeader: string | null,
): { origin: string; nonce: string } | null => {
    const raw = getCookieFromHeader(cookieHeader ?? "", NONCE_COOKIE)
    if (!raw) return null
    const sep = raw.indexOf(" ")
    if (sep <= 0) return null
    const origin = raw.slice(0, sep)
    const nonce = raw.slice(sep + 1)
    return nonce ? { origin, nonce } : null
}

/**
 * PDS の nonce を持ち越す `Set-Cookie` の値。値はトークンを含まない（nonce は公開の値）。
 *
 * 例: `nonceCookie("https://pds.example", "n1")` → `"atp_dpop_nonce=https%3A%2F%2Fpds.example%20n1; Path=/; ..."`
 */
export const nonceCookie = (origin: string, nonce: string): string => {
    const parts = [
        `${NONCE_COOKIE}=${encodeURIComponent(`${origin} ${nonce}`)}`,
        "Path=/",
        `Max-Age=${NONCE_MAX_AGE}`,
        "HttpOnly",
        "SameSite=Strict",
    ]
    if (process.env.PUBLIC_NODE_ENV === "production") parts.push("Secure")
    return parts.join("; ")
}

/**
 * アクセストークンの期限が近ければ更新する（自動再開と、アカウントの切り替えで共通）。
 *
 * Input:
 * - `s`: OAuth のセッション
 * - `now`: 現在時刻（UNIX 秒）
 *
 * Output:
 * - 成功: 使うセッションと、更新したか
 * - 失敗: 失効・不正は 401、頻度制限は 429、秘密鍵の未設定は 500、一時的な失敗は 502
 *
 * 例:
 * - 入力: 期限まで10分のセッション → 出力: `{ ok: true, session: s, refreshed: false }`
 * - 入力: 期限まで30秒のセッション → 出力: `{ ok: true, session: <新しいトークン>, refreshed: true }`
 */
export const ensureFreshOAuthSession = async (
    s: OAuthSession,
    now: number,
    fetchImpl: typeof fetch = fetch,
): Promise<
    | { ok: true; session: OAuthSession; refreshed: boolean }
    | { ok: false; status: ResumeFailureStatus }
> => {
    if (s.oauth.expiresAt - now >= REFRESH_MARGIN_SECONDS) {
        return { ok: true, session: s, refreshed: false }
    }
    const client = await loadClientKey(await getOAuthClientSecret())
    const result = await requestTokens(
        {
            tokenEndpoint: s.oauth.tokenEndpoint,
            issuer: s.oauth.issuer,
            client,
            clientId: s.oauth.clientId,
            grant: {
                type: "refresh_token",
                refreshToken: s.oauth.refreshToken,
            },
            dpop: await createDpopSession(s.oauth.dpopJwk),
            now,
        },
        fetchImpl,
    )
    if (!result.ok) {
        switch (result.kind) {
            case "Expired":
            case "Invalid":
                return { ok: false, status: 401 }
            case "RateLimited":
                return { ok: false, status: 429 }
            case "NotConfigured":
                return { ok: false, status: 500 }
            default:
                return { ok: false, status: 502 }
        }
    }
    // 持ち主が変わったトークンは受け付けない（同じアカウントのセッションでなくなるため）
    if (result.tokens.sub !== s.did) return { ok: false, status: 401 }
    return {
        ok: true,
        refreshed: true,
        session: {
            ...s,
            oauth: {
                ...s.oauth,
                accessToken: result.tokens.accessToken,
                refreshToken: result.tokens.refreshToken,
                expiresAt: result.tokens.expiresAt,
            },
        },
    }
}

/**
 * v2 の API のために OAuth のセッションを再開する。
 *
 * Input:
 * - `s`: cookie から読んだ OAuth のセッション
 * - `cookieHeader`: 要求の Cookie ヘッダー（持ち越した nonce を読む）
 * - `now`: 現在時刻（UNIX 秒）
 *
 * Output:
 * - 成功: エージェント・アカウントの識別子とハンドル・PDS と、応答の直前に呼ぶ `collectSetCookies`
 * - 失敗: `ensureFreshOAuthSession` と同じ状態
 *
 * 例:
 * - `const r = await resumeOAuthSession(s, request.headers.get("cookie"), nowSec())`
 * - `for (const c of r.collectSetCookies()) headers.append("set-cookie", c)`
 */
export const resumeOAuthSession = async (
    s: OAuthSession,
    cookieHeader: string | null,
    now: number,
    fetchImpl: typeof fetch = fetch,
): Promise<
    | {
          ok: true
          agent: Agent
          identity: { did: string; handle: string }
          pds: string
          collectSetCookies: () => string[]
      }
    | { ok: false; status: ResumeFailureStatus }
> => {
    const fresh = await ensureFreshOAuthSession(s, now, fetchImpl)
    if (!fresh.ok) return fresh
    const { session } = fresh

    const dpop = await createDpopSession(session.oauth.dpopJwk)
    const pdsOrigin = new URL(session.pds).origin
    const carried = readNonceCookie(cookieHeader)
    const initialNonce =
        carried && carried.origin === pdsOrigin ? carried.nonce : undefined
    if (initialNonce) dpop.nonces.set(pdsOrigin, initialNonce)

    const fetchPds = createDpopFetch({
        pdsUrl: session.pds,
        accessToken: session.oauth.accessToken,
        dpop,
        now: () => Math.floor(Date.now() / 1000),
        fetchImpl,
    })
    const { createOAuthAgent } = await import("./oauthAgent")
    const agent = createOAuthAgent(session.did, fetchPds)

    return {
        ok: true,
        agent,
        identity: { did: session.did, handle: session.handle },
        pds: session.pds,
        collectSetCookies: () => {
            const cookies: string[] = []
            // 更新したときだけ書き戻す（古い更新用トークンを並行する応答で書き戻さないため）
            if (fresh.refreshed) cookies.push(makeSessionSetCookie(session))
            const latest = dpop.nonces.get(pdsOrigin)
            if (latest && latest !== initialNonce) {
                cookies.push(nonceCookie(pdsOrigin, latest))
            }
            return cookies
        },
    }
}

/**
 * 更新用トークンを認可サーバーで取り消す（ログアウト）。失敗しても例外を投げない。
 *
 * Input: `s`: ログアウトする OAuth のセッション、`now`: 現在時刻（UNIX 秒）
 * Output: なし
 */
export const revokeOAuthSession = async (
    s: OAuthSession,
    now: number,
    fetchImpl: typeof fetch = fetch,
): Promise<void> => {
    try {
        const client = await loadClientKey(await getOAuthClientSecret())
        await revokeToken(
            {
                revocationEndpoint: s.oauth.revocationEndpoint,
                issuer: s.oauth.issuer,
                client,
                clientId: s.oauth.clientId,
                refreshToken: s.oauth.refreshToken,
                dpop: await createDpopSession(s.oauth.dpopJwk),
                now,
            },
            fetchImpl,
        )
    } catch {
        console.warn("oauth session: revoke skipped")
    }
}
