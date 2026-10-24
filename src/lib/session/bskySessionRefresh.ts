/**
 * bsky セッションの自動再開・トークンローテーション書き戻しミドルウェア。
 *
 * 責務と処理概要:
 * - `/v2/` 配下（`/v2/bsky/session` とその配下を除く）へのリクエストを対象に、
 *   `atp_session` cookie からセッションを再開する。アプリパスワードのセッションは `AtpAgent.resumeSession` で、
 *   OAuth のセッションは `resumeOAuthSession`（期限の近いときだけ更新し、DPoP つきで PDS へ送るエージェント）で再開する。
 * - `resumeSession` は呼ぶたびに必ず `refreshSession`（atproto側のトークンローテーション）を
 *   実行する実装（`@atproto/api`）になっているため、ここで得られる `agent.session` は
 *   常に新しいトークン対になっている。これをレスポンスの `Set-Cookie` として書き戻すことで、
 *   各APIハンドラが個別にローテーションを握りつぶして cookie を失効させてしまう不具合を防ぐ。
 * - OAuth のセッションは毎回は更新しない。更新したときだけセッションの cookie を、PDS の nonce が
 *   変わったときだけ nonce の cookie を書き戻す（古い更新用トークンを並行する応答で書き戻すと、
 *   認可サーバーが再利用とみなしてセッション全体を失効させるため）。
 * - 認証済みハンドラは `context.locals.agent`/`context.locals.session`/`context.locals.service`
 *   を参照するだけでよく、セッションの種類も cookie の復号も意識しない。
 * - `/v2/bsky/session`（GET/POST/PUT）と `/v2/bsky/session/{did}`（DELETE）は、
 *   アカウント追加・切り替え・ログアウトという通常と異なるセッション操作を行うため対象外とする
 *   （各エンドポイントが目的に応じて個別にセッションを取り扱う）。
 *
 * 実装上の制約:
 * - このミドルウェアは全リクエストで読み込まれる。`@atproto/api`（約1.3MB）を静的に importすると、
 *   対象外のリクエスト（entry詳細のキャッシュHITや静的アセットの404など）でも Worker の起動
 *   （cold start）のたびに評価コスト（約70ms）がかかり、無料枠の CPU 上限を圧迫する。
 *   このため `agentFactory` と `oauthSession` は対象パスで認証処理を始める時点で動的に importする。
 */
import type { MiddlewareHandler } from "astro"
import {
    parseSessionFromRequest,
    makeSessionSetCookie,
    type OAuthSession,
    type StoredSession,
} from "@/lib/session/cookies.js"
import {
    errorResponseFromStatus,
    resolveXrpcStatus,
} from "@/lib/api/response.js"

/**
 * このミドルウェアが認証処理の対象とするパスかどうかを判定する。
 *
 * Input:
 * - `pathname`: リクエストURLのパス部分
 *
 * Output:
 * - `/v2/` 配下かつ `/v2/bsky/session` 系でなければ `true`
 */
export const isManagedByThisMiddleware = (pathname: string): boolean => {
    if (!pathname.startsWith("/v2/")) return false
    if (pathname === "/v2/bsky/session") return false
    if (pathname.startsWith("/v2/bsky/session/")) return false
    return true
}

/**
 * 対象パスのリクエストに対し、bskyセッションを再開し `context.locals` へ供給した上で
 * ハンドラを実行し、レスポンスにローテーション後のセッションを書き戻す。
 *
 * Input:
 * - `context`: Astro のリクエストコンテキスト（`request`/`locals` 等）
 * - `next`: 後続のルートハンドラ（または後続ミドルウェア）を実行する関数
 *
 * Output:
 * - 対象外パス: `next()` の結果をそのまま返す
 * - 対象パスで未認証/セッション失効: 401（またはXRPCエラーに応じたステータス）
 * - 対象パスで認証成功: ハンドラのレスポンスに `Set-Cookie` を追加したもの
 *
 * 失敗時の方針:
 * - cookie が無い/壊れている: 401
 * - `resumeSession` が失敗（refreshJwt失効等）: `resolveXrpcStatus` で正規化したステータス
 * - OAuth のセッションの更新が失敗: 失効は 401、頻度制限は 429、それ以外は 500/502
 */
export const refreshBskySession: MiddlewareHandler = async (context, next) => {
    const { pathname } = context.url
    if (!isManagedByThisMiddleware(pathname)) {
        return next()
    }

    let stored: StoredSession | undefined
    try {
        stored = parseSessionFromRequest(context.request)
    } catch {
        stored = undefined
    }
    if (!stored) {
        return errorResponseFromStatus(401)
    }
    if (stored.kind === "oauth") {
        return resumeWithOAuth(context, next, stored)
    }

    const { session, service } = stored
    const { createAtpAgent } = await import("@/lib/atproto/agentFactory")
    const agent = createAtpAgent(service)
    try {
        await agent.resumeSession({
            refreshJwt: session.refreshJwt,
            accessJwt: session.accessJwt,
            handle: session.handle,
            did: session.did,
            active: true,
        })
    } catch (err) {
        console.warn("bskySessionRefresh: resumeSession failed", err)
        return errorResponseFromStatus(resolveXrpcStatus(err))
    }

    context.locals.agent = agent
    context.locals.session = agent.session
    context.locals.service = service

    const response = await next()

    // resumeSession は必ずトークンをローテーションするため、成功時は常に書き戻す。
    const refreshed = agent.session
    if (!refreshed) {
        return response
    }
    return appendSetCookies(response, [
        makeSessionSetCookie({ kind: "password", session: refreshed, service }),
    ])
}

/**
 * OAuth のセッションを再開してハンドラを実行し、必要なときだけ cookie を書き戻す（内部処理）。
 *
 * Input:
 * - `context` / `next`: ミドルウェアの引数
 * - `stored`: cookie から読んだ OAuth のセッション
 *
 * Output:
 * - 再開に失敗: 失効は 401、頻度制限は 429、それ以外は 500/502
 * - 成功: ハンドラのレスポンスに、更新したセッションと変わった nonce の `Set-Cookie` を足したもの
 */
const resumeWithOAuth = async (
    context: Parameters<MiddlewareHandler>[0],
    next: Parameters<MiddlewareHandler>[1],
    stored: OAuthSession,
): Promise<Response> => {
    const { resumeOAuthSession } = await import("./oauthSession")
    const resumed = await resumeOAuthSession(
        stored,
        context.request.headers.get("cookie"),
        Math.floor(Date.now() / 1000),
    )
    if (!resumed.ok) {
        console.warn(`bskySessionRefresh: oauth session ${resumed.status}`)
        return errorResponseFromStatus(resumed.status)
    }
    context.locals.agent = resumed.agent
    context.locals.session = resumed.identity
    context.locals.service = resumed.pds

    const response = await next()
    return appendSetCookies(response, resumed.collectSetCookies())
}

/**
 * レスポンスに `Set-Cookie` を足す（内部ユーティリティ）。足すものが無ければそのまま返す。
 */
const appendSetCookies = (response: Response, cookies: string[]): Response => {
    if (cookies.length === 0) return response
    const headers = new Headers(response.headers)
    for (const cookie of cookies) headers.append("set-cookie", cookie)
    return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers,
    })
}
