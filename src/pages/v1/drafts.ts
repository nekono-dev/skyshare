/**
 * Skyshare v1 drafts API。
 *
 * 責務と処理概要:
 * - Cookie セッションを再開し、Bluesky の `app.bsky.draft.*` API を仲介する。
 * - GET/DELETE で下書きの一覧取得と削除のみを提供する。
 * - OpenAPI 生成スキーマで入力と出力を検証し、共通エラー形式へ正規化する。
 *
 * 実装上の制約:
 * - Cloudflare Workers 環境で動作するため Node.js 固有 API は使わない。
 */

import type { APIRoute } from "astro"
import { AtpAgent } from "@atproto/api"
import { XRPCError } from "@atproto/xrpc"

import { convertHeaderToObj, errorResponseFromStatus } from "@/lib/api.js"
import { parseSessionFromRequest } from "@/lib/cookies.js"

type DraftPostPayload = {
    text: string
    labels?: Record<string, unknown>
    embedImages?: Record<string, unknown>[]
    embedVideos?: Record<string, unknown>[]
    embedExternals?: Record<string, unknown>[]
    embedRecords?: Record<string, unknown>[]
}

type DraftPayload = {
    posts: DraftPostPayload[]
    langs?: string[]
    postgateEmbeddingRules?: Record<string, unknown>[]
    threadgateAllow?: Record<string, unknown>[]
}

type DraftViewPayload = {
    id: string
    draft: DraftPayload
    createdAt: string
    updatedAt: string
}

/**
 * XRPC エラーを HTTP ステータスへ変換する。
 *
 * 処理の趣旨:
 * - draft API の既知エラーを API の共通ステータスへ正規化する。
 *
 * Input:
 * - `error`: catch した unknown エラー
 *
 * Output:
 * - 対応する HTTP ステータス
 *
 * 例:
 * - 入力: `XRPCError("AuthenticationRequired")`
 * - 出力: `401`
 */
const resolveXrpcStatus = (error: unknown): number => {
    if (!(error instanceof XRPCError)) {
        return 500
    }

    switch (error.error) {
        case "AuthenticationRequired":
        case "InvalidToken":
        case "ExpiredToken":
            return 401
        case "RateLimitExceeded":
        case "DraftLimitReached":
            return 429
        default:
            return 500
    }
}

/**
 * 値がプレーンオブジェクトかを判定する。
 *
 * 処理の趣旨:
 * - API 入力の最小要件を検証するため、null/配列を除外する。
 *
 * Input:
 * - `value`: 判定対象
 *
 * Output:
 * - プレーンオブジェクトなら `true`
 *
 * 例:
 * - 入力: `{ a: 1 }`
 * - 出力: `true`
 */
const isObjectRecord = (value: unknown): value is Record<string, unknown> => {
    return value !== null && typeof value === "object" && !Array.isArray(value)
}

/**
 * 値が文字列配列かを判定する。
 *
 * Input:
 * - `value`: 判定対象
 *
 * Output:
 * - 文字列配列なら `true`
 *
 * 例:
 * - 入力: `["ja", "en"]`
 * - 出力: `true`
 */
const isStringArray = (value: unknown): value is string[] => {
    return Array.isArray(value) && value.every(v => typeof v === "string")
}

/**
 * 値がオブジェクト配列かを判定する。
 *
 * Input:
 * - `value`: 判定対象
 *
 * Output:
 * - オブジェクト配列なら `true`
 *
 * 例:
 * - 入力: `[{ key: "value" }]`
 * - 出力: `true`
 */
const isObjectArray = (value: unknown): value is Record<string, unknown>[] => {
    return Array.isArray(value) && value.every(isObjectRecord)
}

/**
 * 下書き投稿要素を最小要件で検証する。
 *
 * 想定する入力形状(必要な場合):
 * - `text` を必須とし、埋め込み/ラベルは任意オブジェクトとして扱う。
 *
 * 処理の趣旨:
 * - app.bsky.draft.defs#draftPost の実用上必要な最低形状を保証する。
 *
 * Input:
 * - `value`: draftPost 候補
 *
 * Output:
 * - 検証済み `DraftPostPayload`。不正時は `undefined`
 *
 * 例:
 * - 入力: `{ text: "hello" }`
 * - 出力: `{ text: "hello" }`
 */
const parseDraftPost = (value: unknown): DraftPostPayload | undefined => {
    if (!isObjectRecord(value)) {
        return undefined
    }

    if (typeof value.text !== "string") {
        return undefined
    }

    if (value.labels !== undefined && !isObjectRecord(value.labels)) {
        return undefined
    }

    if (value.embedImages !== undefined && !isObjectArray(value.embedImages)) {
        return undefined
    }

    if (value.embedVideos !== undefined && !isObjectArray(value.embedVideos)) {
        return undefined
    }

    if (
        value.embedExternals !== undefined &&
        !isObjectArray(value.embedExternals)
    ) {
        return undefined
    }

    if (
        value.embedRecords !== undefined &&
        !isObjectArray(value.embedRecords)
    ) {
        return undefined
    }

    return {
        text: value.text,
        labels: value.labels,
        embedImages: value.embedImages,
        embedVideos: value.embedVideos,
        embedExternals: value.embedExternals,
        embedRecords: value.embedRecords,
    }
}

/**
 * 下書き本体を最小要件で検証する。
 *
 * Input:
 * - `value`: draft 候補
 *
 * Output:
 * - 検証済み `DraftPayload`。不正時は `undefined`
 *
 * 例:
 * - 入力: `{ posts: [{ text: "hello" }] }`
 * - 出力: `{ posts: [{ text: "hello" }] }`
 */
const parseDraft = (value: unknown): DraftPayload | undefined => {
    if (!isObjectRecord(value)) {
        return undefined
    }

    if (!Array.isArray(value.posts) || value.posts.length === 0) {
        return undefined
    }

    const posts = value.posts
        .map(parseDraftPost)
        .filter((post): post is DraftPostPayload => post !== undefined)

    if (posts.length !== value.posts.length) {
        return undefined
    }

    if (value.langs !== undefined && !isStringArray(value.langs)) {
        return undefined
    }

    if (
        value.postgateEmbeddingRules !== undefined &&
        !isObjectArray(value.postgateEmbeddingRules)
    ) {
        return undefined
    }

    if (
        value.threadgateAllow !== undefined &&
        !isObjectArray(value.threadgateAllow)
    ) {
        return undefined
    }

    return {
        posts,
        langs: value.langs,
        postgateEmbeddingRules: value.postgateEmbeddingRules,
        threadgateAllow: value.threadgateAllow,
    }
}

/**
 * 下書き削除リクエストを検証する。
 *
 * Input:
 * - `value`: JSON ボディ候補
 *
 * Output:
 * - 検証済み `{ id }`。不正時は `undefined`
 *
 * 例:
 * - 入力: `{ id: "3ldrafttid" }`
 * - 出力: 同等オブジェクト
 */
const parseDeleteDraftBody = (value: unknown): { id: string } | undefined => {
    if (!isObjectRecord(value) || typeof value.id !== "string") {
        return undefined
    }
    return { id: value.id }
}

/**
 * 下書き一覧クエリを検証する。
 *
 * Input:
 * - `request`: HTTP リクエスト
 *
 * Output:
 * - 検証済み `{ limit?, cursor? }`。不正時は `undefined`
 *
 * 例:
 * - 入力: `GET /v1/drafts?limit=20&cursor=abc`
 * - 出力: `{ limit: 20, cursor: "abc" }`
 */
const parseDraftQuery = (
    request: Request,
): { limit?: number; cursor?: string } | undefined => {
    const url = new URL(request.url)
    const limitRaw = url.searchParams.get("limit")
    const cursorRaw = url.searchParams.get("cursor")

    const query: { limit?: number; cursor?: string } = {}

    if (limitRaw !== null) {
        const limit = Number(limitRaw)
        if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
            return undefined
        }
        query.limit = limit
    }

    if (cursorRaw !== null) {
        if (cursorRaw.length === 0) {
            return undefined
        }
        query.cursor = cursorRaw
    }

    return query
}

/**
 * 下書き一覧レスポンスを最小要件で検証する。
 *
 * Input:
 * - `value`: getDrafts のレスポンス候補
 *
 * Output:
 * - 検証済み `{ cursor?, drafts }`。不正時は `undefined`
 *
 * 例:
 * - 入力: `{ drafts: [{ id, draft, createdAt, updatedAt }] }`
 * - 出力: 同等オブジェクト
 */
const parseDraftViewsResponse = (
    value: unknown,
): { cursor?: string; drafts: DraftViewPayload[] } | undefined => {
    if (!isObjectRecord(value) || !Array.isArray(value.drafts)) {
        return undefined
    }

    const parsedDrafts: DraftViewPayload[] = []
    for (const draftView of value.drafts) {
        if (!isObjectRecord(draftView)) {
            return undefined
        }

        if (
            typeof draftView.id !== "string" ||
            typeof draftView.createdAt !== "string" ||
            typeof draftView.updatedAt !== "string"
        ) {
            return undefined
        }

        const draft = parseDraft(draftView.draft)
        if (!draft) {
            return undefined
        }

        parsedDrafts.push({
            id: draftView.id,
            draft,
            createdAt: draftView.createdAt,
            updatedAt: draftView.updatedAt,
        })
    }

    if (value.cursor !== undefined && typeof value.cursor !== "string") {
        return undefined
    }

    return {
        cursor: value.cursor,
        drafts: parsedDrafts,
    }
}

/**
 * Cookie ヘッダの存在を検証する。
 *
 * Input:
 * - `request`: HTTP リクエスト
 *
 * Output:
 * - cookie があれば `true`
 *
 * 例:
 * - 入力: Cookie ヘッダ付きリクエスト
 * - 出力: `true`
 */
const hasCookieHeader = (request: Request): boolean => {
    const headers = convertHeaderToObj(request.headers)
    return typeof headers.cookie === "string" && headers.cookie.length > 0
}

/**
 * Request から認証済み AtpAgent を生成する。
 *
 * 処理の趣旨:
 * - `atp_session` cookie を復号して `AtpAgent.resumeSession` を行い、
 *   以降の draft API 呼び出しを安全に実行できる状態を作る。
 *
 * Input:
 * - `request`: HTTP リクエスト
 *
 * Output:
 * - 認証再開済み `AtpAgent`
 *
 * 例:
 * - 入力: Cookie を含む Request
 * - 出力: `app.bsky.draft.*` が呼べる agent
 */
const resumeDraftAgent = async (request: Request): Promise<AtpAgent> => {
    const { session, service } = parseSessionFromRequest(request)
    if (!session || !service) {
        throw new Error("UNAUTHORIZED")
    }

    const agent = new AtpAgent({ service })
    await agent.resumeSession({
        refreshJwt: session.refreshJwt,
        accessJwt: session.accessJwt,
        handle: session.handle,
        did: session.did,
        active: true,
    })
    return agent
}

/**
 * GET /v1/drafts: 下書き一覧を取得する。
 *
 * Input:
 * - `request`: cookie と query を含む HTTP リクエスト
 *
 * Output:
 * - 200: `{ cursor?: string, drafts: DraftView[] }`
 * - 4xx/5xx: 共通エラー JSON
 *
 * 例:
 * - 入力: `GET /v1/drafts?limit=20`
 * - 出力: `{"drafts":[...],"cursor":"..."}`
 */
export const GET: APIRoute = async ({ request }: { request: Request }) => {
    try {
        if (!hasCookieHeader(request)) {
            return errorResponseFromStatus(400)
        }

        const query = parseDraftQuery(request)
        if (!query) {
            return errorResponseFromStatus(400)
        }

        let agent: AtpAgent
        try {
            agent = await resumeDraftAgent(request)
        } catch (error) {
            if (error instanceof Error && error.message === "UNAUTHORIZED") {
                return errorResponseFromStatus(401)
            }
            throw error
        }

        const response = await agent.app.bsky.draft.getDrafts({
            limit: query.limit,
            cursor: query.cursor,
        })

        const validatedResponse = parseDraftViewsResponse({
            cursor: response.data.cursor,
            drafts: response.data.drafts,
        })
        if (!validatedResponse) {
            console.error("drafts.ts GET: invalid draft response")
            return errorResponseFromStatus(500)
        }

        return new Response(JSON.stringify(validatedResponse), {
            status: 200,
            headers: { "Content-Type": "application/json" },
        })
    } catch (error) {
        console.error("drafts.ts GET:", error)
        return errorResponseFromStatus(resolveXrpcStatus(error))
    }
}

/**
 * DELETE /v1/drafts: 下書きを削除する。
 *
 * Input:
 * - `request`: cookie と削除対象 id JSON を含む HTTP リクエスト
 *
 * Output:
 * - 200: 本文なし
 * - 4xx/5xx: 共通エラー JSON
 *
 * 例:
 * - 入力: `{ "id": "3ldrafttid" }`
 * - 出力: `status 200`
 */
export const DELETE: APIRoute = async ({ request }: { request: Request }) => {
    try {
        if (!hasCookieHeader(request)) {
            return errorResponseFromStatus(400)
        }

        const rawBody = parseDeleteDraftBody(await request.json())
        if (!rawBody) {
            return errorResponseFromStatus(400)
        }

        let agent: AtpAgent
        try {
            agent = await resumeDraftAgent(request)
        } catch (error) {
            if (error instanceof Error && error.message === "UNAUTHORIZED") {
                return errorResponseFromStatus(401)
            }
            throw error
        }

        await agent.app.bsky.draft.deleteDraft({
            id: rawBody.id,
        })

        return new Response(undefined, { status: 200 })
    } catch (error) {
        console.error("drafts.ts DELETE:", error)
        return errorResponseFromStatus(resolveXrpcStatus(error))
    }
}
