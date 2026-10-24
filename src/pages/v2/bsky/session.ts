import type { APIRoute } from "astro"

import { createAtpAgent } from "@/lib/atproto/agentFactory"
import {
    admitSession,
    makeSessionSetCookie,
    makeAccountsSetCookies,
    parseSessionFromRequest,
    parseAccountsFromRequest,
    sessionIdentity,
    toPooledAccount,
    upsertPooledAccount,
    type StoredSession,
} from "@/lib/session/cookies.js"
import { ensureFreshOAuthSession } from "@/lib/session/oauthSession"
import * as PostSchema from "@/lib/api/schema/v2/bsky/session/post"
import * as PutSchema from "@/lib/api/schema/v2/bsky/session/put"

import {
    errorResponseFromStatus,
    resolveXrpcStatus,
} from "@/lib/api/response.js"
import { hasCookieHeader } from "@/util/http"
import { atpService } from "@/env.js"

/**
 * Skyshare v2 bsky/session API。
 *
 * 概要:
 * - GET: この端末で有効なアクティブアカウント＋プール中の非アクティブアカウントの一覧を返す（トークンは含めない）。
 * - POST: アプリパスワードの認証情報を受け取り atproto へ login を実行する。既に別アカウントがアクティブな場合は、
 *   そのセッションをプール(`atp_account_<n>`)へ退避してから新しいセッションに切り替える（アカウント追加ログイン）。
 *   OAuth によるログインは `session/authorization` が受け持ち、同じ規則（`admitSession`）でプールを決める。
 * - PUT: プール中のアカウントを、現在のアクティブアカウントと入れ替える（アカウント切り替え）。
 *   「session を別の session で上書きする」という操作であるため、対象はリソース本体(body の `did`)で指定する。
 *   切り替え先が OAuth のセッションなら、期限の近いアクセストークンを更新してからアクティブにする。
 *
 * 実装上の制約:
 * - セッショントークン本体は常に HttpOnly cookie 内にのみ存在させ、レスポンス JSON には一切含めない
 *   （クライアント JS からトークンを読み取れる状態を作らないことが、複数アカウント機能導入時の必須要件）。
 * - 全レスポンスに `Cache-Control: no-store` を付与する。GET のURLはクエリを持たず常に同一のため、
 *   これが無いとログイン前に取得した 401/空一覧のレスポンスがブラウザ/CDNにキャッシュされ、
 *   ログイン直後もキャッシュされた古い応答が返り続ける不具合が起きる。
 */

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
        const agent = createAtpAgent(atpService)
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

        const activeSession = parseSessionFromRequest(request)
        const pool = parseAccountsFromRequest(request)

        if (!activeSession && pool.length === 0) {
            return errorResponseFromStatus(401)
        }

        // アクティブアカウントを先頭に、プール中のアカウントを続けて並べる。
        const entries: { did: string; handle: string; isActive: boolean }[] = []
        if (activeSession) {
            entries.push({ ...sessionIdentity(activeSession), isActive: true })
        }
        for (const account of pool) {
            entries.push({ ...sessionIdentity(account), isActive: false })
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
            headers: {
                "Content-Type": "application/json",
                "Cache-Control": "no-store",
            },
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
 * - 成功時: 200 + `set-cookie` ヘッダ（`atp_session` / `atp_account_<n>`）
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

        const agent = createAtpAgent(service)
        const response = await agent.login({
            identifier,
            password,
        })
        const incoming: StoredSession = {
            kind: "password",
            session: { ...response.data, active: response.data.active ?? true },
            service,
        }

        // 新しくログインしたアカウントがプールにあれば除き、別アカウントがアクティブならプールへ退避する。
        const pool = admitSession(
            parseSessionFromRequest(request),
            parseAccountsFromRequest(request),
            incoming,
        )
        if (!pool) {
            // アカウント数の上限到達。利用者向けの文言はサーバーでは返さず、
            // 状態の競合を表す 409 をクライアントが表示言語の文言へ対応づける。
            return errorResponseFromStatus(409)
        }

        const headers = new Headers()
        headers.append("set-cookie", makeSessionSetCookie(incoming))
        for (const cookie of makeAccountsSetCookies(pool)) {
            headers.append("set-cookie", cookie)
        }
        headers.set("Cache-Control", "no-store")

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
 * - 200: `set-cookie` ヘッダ（`atp_session` / `atp_account_<n>`）のみ、本文なし
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

        const currentSession = parseSessionFromRequest(request)
        const pool = parseAccountsFromRequest(request)

        const targetIndex = pool.findIndex(
            account => sessionIdentity(account).did === body.data.did,
        )
        if (targetIndex === -1) {
            return errorResponseFromStatus(404)
        }
        const target = pool[targetIndex]!
        const remainingPool = pool.filter((_, index) => index !== targetIndex)

        const resumed = await resumeTarget(target)
        if (!resumed.ok) return errorResponseFromStatus(resumed.status)

        // 現在アクティブなアカウントがあれば、切り替え後はプール側へ戻す。
        const nextPool = currentSession
            ? upsertPooledAccount(
                  remainingPool,
                  toPooledAccount(currentSession),
              )
            : remainingPool

        const headers = new Headers()
        headers.append("set-cookie", makeSessionSetCookie(resumed.session))
        for (const cookie of makeAccountsSetCookies(nextPool)) {
            headers.append("set-cookie", cookie)
        }
        headers.set("Cache-Control", "no-store")

        return new Response(undefined, { status: 200, headers })
    } catch (err) {
        console.error("session.ts PUT:", err)
        return errorResponseFromStatus(500)
    }
}

/**
 * 切り替え先のセッションを検証し、最新のトークンにする（PUT の内部処理）。
 *
 * 処理の趣旨:
 * - アプリパスワードのセッションは `resumeSession` で再開する。`resumeSession` は必ず refreshSession を
 *   実行するため、これ自体がトークンの有効性チェックになり、成功時はローテーション後の新しいトークン対が
 *   `agent.session` に反映される（古い refreshJwt を cookie に残すと、次回の切り替えが失効扱いになるため書き戻す）。
 * - OAuth のセッションは、期限の近いアクセストークンだけを更新する（毎回更新すると、並行する要求で
 *   更新用トークンの再利用とみなされ、セッションが失効するため）。
 *
 * Input:
 * - `target`: プールから取り出した切り替え先
 *
 * Output:
 * - 成功: アクティブにするセッション
 * - 失敗: 失効は 401、OAuth の更新の失敗は `ensureFreshOAuthSession` の状態
 */
const resumeTarget = async (
    target: StoredSession,
): Promise<
    { ok: true; session: StoredSession } | { ok: false; status: number }
> => {
    if (target.kind === "oauth") {
        const fresh = await ensureFreshOAuthSession(
            target,
            Math.floor(Date.now() / 1000),
        )
        if (!fresh.ok) {
            console.warn("session.ts PUT: target oauth session invalid")
            return fresh
        }
        const { addedAt: _addedAt, ...session } = fresh.session as OAuthPooled
        return { ok: true, session }
    }
    const agent = createAtpAgent(target.service)
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
            return { ok: false, status: 401 }
        }
        throw err
    }
    return {
        ok: true,
        session: {
            kind: "password",
            session: agent.session ?? target.session,
            service: target.service,
        },
    }
}

/** プールから取り出した OAuth のセッション（退避した時刻を持ちうる） */
type OAuthPooled = Extract<StoredSession, { kind: "oauth" }> & {
    addedAt?: string
}
