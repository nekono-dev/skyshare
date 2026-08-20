/**
 * Skyshare v2 bsky/drafts API。
 *
 * 責務と処理概要:
 * - Bluesky の `app.bsky.draft.*` API を仲介する（認証済みセッションは
 *   `bskySessionRefresh` ミドルウェアが `locals.agent` として供給する）。
 * - `v2/bsky` はBluesky APIをbypassするリソース群の名前空間であり、skyshare固有の
 *   処理（entry作成等）は含めない。
 * - OpenAPI 生成スキーマで入力と出力を検証し、共通エラー形式へ正規化する。
 *
 * 実装上の制約:
 * - Cloudflare Workers 環境で動作するため Node.js 固有 API は使わない。
 */

import type { APIRoute } from "astro"

import {
    errorResponseFromStatus,
    resolveXrpcStatus,
} from "@/lib/api/response.js"
import {
    buildSelfLabels,
    parseCreateDraftBody,
    parseDeleteDraftBody,
    parseDraftQuery,
    parseDraftViewsResponse,
    parseUpdateDraftBody,
} from "@/lib/atproto/draft"

/**
 * GET /v2/bsky/drafts: 下書き一覧を取得する。
 *
 * Input:
 * - `request`: cookie と query を含む HTTP リクエスト
 *
 * Output:
 * - 200: `{ cursor?: string, drafts: DraftView[] }`
 * - 4xx/5xx: 共通エラー JSON
 *
 * 例:
 * - 入力: `GET /v2/bsky/drafts?limit=20`
 * - 出力: `{"drafts":[...],"cursor":"..."}`
 */
export const GET: APIRoute = async ({ request, locals }) => {
    try {
        const { agent } = locals
        if (!agent) {
            return errorResponseFromStatus(401)
        }

        const query = parseDraftQuery(request)
        if (!query) {
            return errorResponseFromStatus(400)
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
 * POST /v2/bsky/drafts: 下書きを新規作成する。
 *
 * Input:
 * - `request`: cookie と `{ text, labels? }` を含む HTTP リクエスト
 *
 * Output:
 * - 200: `{ id: string }`
 * - 4xx/5xx: 共通エラー JSON
 *
 * 例:
 * - 入力: `{ "text": "hello" }`
 * - 出力: `{"id":"3ldrafttid"}`
 */
export const POST: APIRoute = async ({ request, locals }) => {
    try {
        const { agent } = locals
        if (!agent) {
            return errorResponseFromStatus(401)
        }

        const body = parseCreateDraftBody(await request.json())
        if (!body) {
            return errorResponseFromStatus(400)
        }

        const response = await agent.app.bsky.draft.createDraft({
            draft: {
                posts: [
                    {
                        text: body.text,
                        labels: buildSelfLabels(body.labels),
                    },
                ],
            },
        })

        return new Response(JSON.stringify({ id: response.data.id }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
        })
    } catch (error) {
        console.error("drafts.ts POST:", error)
        return errorResponseFromStatus(resolveXrpcStatus(error))
    }
}

/**
 * PUT /v2/bsky/drafts: 既存の下書きを更新する。
 *
 * Input:
 * - `request`: cookie と `{ id, text, labels? }` を含む HTTP リクエスト
 *
 * Output:
 * - 200: 本文なし
 * - 4xx/5xx: 共通エラー JSON
 *
 * 例:
 * - 入力: `{ "id": "3ldrafttid", "text": "hello" }`
 * - 出力: `status 200`
 */
export const PUT: APIRoute = async ({ request, locals }) => {
    try {
        const { agent } = locals
        if (!agent) {
            return errorResponseFromStatus(401)
        }

        const body = parseUpdateDraftBody(await request.json())
        if (!body) {
            return errorResponseFromStatus(400)
        }

        await agent.app.bsky.draft.updateDraft({
            draft: {
                id: body.id,
                draft: {
                    posts: [
                        {
                            text: body.text,
                            labels: buildSelfLabels(body.labels),
                        },
                    ],
                },
            },
        })

        return new Response(undefined, { status: 200 })
    } catch (error) {
        console.error("drafts.ts PUT:", error)
        return errorResponseFromStatus(resolveXrpcStatus(error))
    }
}

/**
 * DELETE /v2/bsky/drafts: 下書きを削除する。
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
export const DELETE: APIRoute = async ({ request, locals }) => {
    try {
        const { agent } = locals
        if (!agent) {
            return errorResponseFromStatus(401)
        }

        const rawBody = parseDeleteDraftBody(await request.json())
        if (!rawBody) {
            return errorResponseFromStatus(400)
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
