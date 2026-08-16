import type { APIRoute } from "astro"
import { AtpAgent } from "@atproto/api"

import {
    makeSessionSetCookie,
    makeAccountsSetCookie,
    parseSessionFromRequest,
    parseAccountsFromRequest,
    toPooledAccount,
    upsertPooledAccount,
    MAX_POOLED_ACCOUNTS,
} from "@/lib/session/cookies.js"
import * as PostSchema from "@/client/openapi/schemas/v2/bsky/session/post"
import * as PutSchema from "@/client/openapi/schemas/v2/bsky/session/put"

import {
    errorResponseFromStatus,
    resolveXrpcStatus,
} from "@/lib/api/response.js"
import { convertHeaderToObj } from "@/util/http"
import { atpService } from "@/env.js"

/**
 * Skyshare v2 bsky/session API。
 *
 * 概要:
 * - GET: この端末で有効なアクティブアカウント＋プール中の非アクティブアカウントの一覧を返す（トークンは含めない）。
 * - POST: 認証情報を受け取り atproto へ login を実行する。既に別アカウントがアクティブな場合は、
 *   そのセッションをプール(`atp_accounts`)へ退避してから新しいセッションに切り替える（アカウント追加ログイン）。
 * - PUT: `atp_accounts` プール中のアカウントを、現在のアクティブアカウントと入れ替える（アカウント切り替え）。
 *   「session を別の session で上書きする」という操作であるため、対象はリソース本体(body の `did`)で指定する。
 *
 * 実装上の制約:
 * - セッショントークン本体は常に HttpOnly cookie 内にのみ存在させ、レスポンス JSON には一切含めない
 *   （クライアント JS からトークンを読み取れる状態を作らないことが、複数アカウント機能導入時の必須要件）。
 */

/**
 * Cookie ヘッダの存在を検証する。
 *
 * Input:
 * - `request`: HTTP リクエスト
 *
 * Output:
 * - cookie があれば `true`
 */
const hasCookieHeader = (request: Request): boolean => {
    const headers = convertHeaderToObj(request.headers)
    return typeof headers.cookie === "string" && headers.cookie.length > 0
}

/**
 * 汎用のエラーレスポンスを生成する（`errorResponseFromStatus` では表現できない具体的な文言用）。
 *
 * Input:
 * - `status`: HTTP ステータス
 * - `message`: エラーメッセージ
 *
 * Output:
 * - `{ error: message }` を持つ `Response`
 */
const errorResponse = (status: number, message: string): Response =>
    new Response(JSON.stringify({ error: message }), {
        status,
        headers: { "content-type": "application/json" },
    })

/**
 * アカウントの表示用メタデータ(displayName/avatarUrl)を取得する。
 *
 * 処理の趣旨:
 * - `app.bsky.actor.getProfile` は公開情報であり認証不要のため、公開 AppView（`atpService`）への
 *   未認証アクセスで取得する。対象アカウント自身の accessJwt/refreshJwt で `resumeSession` してしまうと、
 *   一覧表示のたびに（プール中の非アクティブアカウントまで含めて）不要なトークンリフレッシュが走り、
 *   atproto 側でローテーションした新しい refreshJwt を cookie へ書き戻していない現状の実装では
 *   古い refreshJwt が失効し、かえってセッションを壊しかねない。プロフィール取得は対象アカウントの
 *   認証状態に触れる必要のない公開情報の読み取りに過ぎない。
 * - 取得に失敗しても致命的ではないため例外を握りつぶして `{}` にフォールバックする
 *   （did/handle は cookie 内にすでにあるため一覧自体は表示できる）。
 *
 * Input:
 * - `did`: 対象アカウントの did
 *
 * Output:
 * - `{ displayName?, avatarUrl? }`
 */
const fetchProfileMeta = async (
    did: string,
): Promise<{ displayName?: string; avatarUrl?: string }> => {
    try {
        const agent = new AtpAgent({ service: atpService })
        const profile = await agent.getProfile({ actor: did })
        return {
            displayName: profile.data.displayName,
            avatarUrl: profile.data.avatar,
        }
    } catch (err) {
        console.warn("session.ts: failed to fetch profile meta", err)
        return {}
    }
}

/**
 * GET /v2/bsky/session: この端末で有効なアカウント一覧を取得する。
 *
 * Input:
 * - `request`: cookie を含む HTTP リクエスト
 *
 * Output:
 * - 200: `{ accounts: { did, handle, displayName?, avatarUrl?, isActive }[] }`
 * - 401: アクティブ・プールいずれのアカウントも無い
 *
 * 例:
 * - 出力: `{"accounts":[{"did":"did:plc:abc","handle":"alice.bsky.social","isActive":true}]}`
 */
export const GET: APIRoute = async ({ request }: { request: Request }) => {
    try {
        if (!hasCookieHeader(request)) {
            return errorResponseFromStatus(401)
        }

        const { session: activeSession } = parseSessionFromRequest(request)
        const pool = parseAccountsFromRequest(request)

        if (!activeSession && pool.length === 0) {
            return errorResponseFromStatus(401)
        }

        // アクティブアカウントを先頭に、プール中のアカウントを続けて並べる。
        const entries: { did: string; handle: string; isActive: boolean }[] = []
        if (activeSession) {
            entries.push({
                did: activeSession.did,
                handle: activeSession.handle,
                isActive: true,
            })
        }
        for (const account of pool) {
            entries.push({
                did: account.did,
                handle: account.handle,
                isActive: false,
            })
        }

        const accounts = await Promise.all(
            entries.map(async entry => {
                const meta = await fetchProfileMeta(entry.did)
                return {
                    did: entry.did,
                    handle: entry.handle,
                    displayName: meta.displayName,
                    avatarUrl: meta.avatarUrl,
                    isActive: entry.isActive,
                }
            }),
        )

        return new Response(JSON.stringify({ accounts }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
        })
    } catch (err) {
        console.error("session.ts GET:", err)
        return errorResponseFromStatus(500)
    }
}

/**
 * ログインを実行し、セッションCookieを返す API エンドポイント。
 *
 * 想定する入力形状(最小要件):
 * - JSON ボディに `identifier`・`password`・`service` を含む(いずれも必須)
 *
 * 処理の趣旨:
 * - OpenAPI スキーマで入力検証後、AtpAgent.login の成功結果を Cookie 化して返却する。
 * - 既に別アカウントがアクティブな場合は、そのセッションを `atp_accounts` プールへ退避してから
 *   新しいセッションをアクティブにする（＝アカウント追加ログイン）。同一 did への再ログインは
 *   トークン更新とみなし、プールへは退避しない。
 *
 * Input:
 * - `request`: Astro APIRoute が受け取る HTTP Request
 *
 * Output:
 * - 成功時: 200 + `set-cookie` ヘッダ（`atp_session` / `atp_accounts`）
 * - 失敗時: ステータスに応じたエラーレスポンス
 *
 * 例:
 * - 入力: `{ identifier: "alice", password: "***" }`
 * - 出力: `status: 200` と `set-cookie`
 */
export const POST: APIRoute = async ({ request }: { request: Request }) => {
    try {
        const body = PostSchema.RequestBodySchema.safeParse(
            await request.json(),
        )
        if (!body.success) {
            console.warn("session.ts POST: " + JSON.stringify(body.error))
            return errorResponseFromStatus(400)
        }

        const identifier = body.data.identifier
        const password = body.data.password
        const service = body.data.service || "https://bsky.social"

        const agent = new AtpAgent({ service })
        const response = await agent.login({
            identifier,
            password,
        })
        const session = response.data

        // 新しくログインしたアカウントが既にプールにあれば、アクティブへ昇格させるため一旦除去する。
        let pool = parseAccountsFromRequest(request).filter(
            account => account.did !== session.did,
        )

        const { session: currentSession, service: currentService } =
            parseSessionFromRequest(request)

        if (
            currentSession &&
            currentService &&
            currentSession.did !== session.did
        ) {
            if (pool.length >= MAX_POOLED_ACCOUNTS) {
                return errorResponse(
                    400,
                    "連携できるアカウント数の上限に達しています。先に他のアカウントをログアウトしてください。",
                )
            }
            pool = upsertPooledAccount(
                pool,
                toPooledAccount(currentSession, currentService),
            )
        }

        const headers = new Headers()
        headers.append("set-cookie", makeSessionSetCookie({ session, service }))
        headers.append("set-cookie", makeAccountsSetCookie(pool))

        return new Response(undefined, { status: 200, headers })
    } catch (err: unknown) {
        console.error("session.ts POST:", err)
        // atproto 側の既知エラーを resolveXrpcStatus でHTTPステータスへ正規化する。
        const status = resolveXrpcStatus(err)
        if (status === 401 || status === 429) {
            return errorResponseFromStatus(status)
        }
        return errorResponseFromStatus(500)
    }
}

/**
 * PUT /v2/bsky/session: アクティブなセッションを、プール中の別アカウントのセッションで上書きする（アカウント切り替え）。
 *
 * 想定する入力形状(最小要件):
 * - JSON ボディに `did`（切り替え先アカウントの did）を含む
 *
 * 処理の趣旨:
 * - トークン自体はクライアントに一切渡していないため、切り替え先は did のみで指示する。
 * - 現在のアクティブアカウントは（存在すれば）プールへ戻し、指定された did のアカウントをプールから
 *   取り出してアクティブにする。
 *
 * Input:
 * - `request`: cookie と `{ did }` を含む HTTP リクエスト
 *
 * Output:
 * - 200: `set-cookie` ヘッダ（`atp_session` / `atp_accounts`）のみ、本文なし
 * - 400: 入力不正
 * - 401: 切り替え先アカウントのセッションが atproto 側で失効している
 * - 404: 指定 did がプールに見つからない
 *
 * 例:
 * - 入力: `{ "did": "did:plc:abc123" }`
 * - 出力: `status 200`
 */
export const PUT: APIRoute = async ({ request }: { request: Request }) => {
    try {
        const body = PutSchema.RequestBodySchema.safeParse(await request.json())
        if (!body.success) {
            console.warn("session.ts PUT: " + JSON.stringify(body.error))
            return errorResponseFromStatus(400)
        }

        const { session: currentSession, service: currentService } =
            parseSessionFromRequest(request)
        const pool = parseAccountsFromRequest(request)

        const targetIndex = pool.findIndex(
            account => account.did === body.data.did,
        )
        if (targetIndex === -1) {
            return errorResponseFromStatus(404)
        }
        const target = pool[targetIndex]
        const remainingPool = pool.filter((_, index) => index !== targetIndex)

        // 切り替え先のセッションを atproto 側で検証する。resumeSession は必ず
        // refreshSession を実行するため、これ自体がトークンの有効性チェックになる。
        // refreshJwt が失効していれば XRPCError（401相当）が投げられ、成功時は
        // ローテーション後の新しいトークン対が agent.session に反映される。
        const agent = new AtpAgent({ service: target.service })
        try {
            await agent.resumeSession({
                refreshJwt: target.session.refreshJwt,
                accessJwt: target.session.accessJwt,
                handle: target.session.handle,
                did: target.session.did,
                active: true,
            })
        } catch (err) {
            const status = resolveXrpcStatus(err)
            if (status === 401) {
                console.warn("session.ts PUT: target session invalid")
                return errorResponseFromStatus(401)
            }
            throw err
        }
        // ローテーションされた最新のトークン対を書き戻す（古い refreshJwt を
        // cookie に残すと、次回の切り替えが再び失効扱いになってしまうため）。
        const refreshedSession = agent.session ?? target.session

        // 現在アクティブなアカウントがあれば、切り替え後はプール側へ戻す。
        const nextPool =
            currentSession && currentService
                ? upsertPooledAccount(
                      remainingPool,
                      toPooledAccount(currentSession, currentService),
                  )
                : remainingPool

        const headers = new Headers()
        headers.append(
            "set-cookie",
            makeSessionSetCookie({
                session: refreshedSession,
                service: target.service,
            }),
        )
        headers.append("set-cookie", makeAccountsSetCookie(nextPool))

        return new Response(undefined, { status: 200, headers })
    } catch (err) {
        console.error("session.ts PUT:", err)
        return errorResponseFromStatus(500)
    }
}
