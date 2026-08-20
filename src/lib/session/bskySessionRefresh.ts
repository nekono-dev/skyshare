/**
 * bsky セッションの自動再開・トークンローテーション書き戻しミドルウェア。
 *
 * 責務と処理概要:
 * - `/v2/` 配下（`/v2/bsky/session` とその配下を除く）へのリクエストを対象に、
 *   `atp_session` cookie から `AtpAgent.resumeSession` でセッションを再開する。
 * - `resumeSession` は呼ぶたびに必ず `refreshSession`（atproto側のトークンローテーション）を
 *   実行する実装（`@atproto/api`）になっているため、ここで得られる `agent.session` は
 *   常に新しいトークン対になっている。これをレスポンスの `Set-Cookie` として書き戻すことで、
 *   各APIハンドラが個別にローテーションを握りつぶして cookie を失効させてしまう不具合を防ぐ。
 * - 認証済みハンドラは `context.locals.agent`/`context.locals.session`/`context.locals.service`
 *   を参照するだけでよく、cookie の復号や `resumeSession` を自前で行う必要がなくなる。
 * - `/v2/bsky/session`（GET/POST/PUT）と `/v2/bsky/session/{did}`（DELETE）は、
 *   アカウント追加・切り替え・ログアウトという通常と異なるセッション操作を行うため対象外とする
 *   （各エンドポイントが目的に応じて個別にセッションを取り扱う）。
 */
import { AtpAgent } from "@atproto/api"
import type { MiddlewareHandler } from "astro"
import {
    parseSessionFromRequest,
    makeSessionSetCookie,
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
 */
export const refreshBskySession: MiddlewareHandler = async (context, next) => {
    const { pathname } = context.url
    if (!isManagedByThisMiddleware(pathname)) {
        return next()
    }

    const { session, service } = parseSessionFromRequest(context.request)
    if (!session || !service) {
        return errorResponseFromStatus(401)
    }

    const agent = new AtpAgent({ service })
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
    const headers = new Headers(response.headers)
    headers.append(
        "set-cookie",
        makeSessionSetCookie({ session: refreshed, service }),
    )
    return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers,
    })
}
