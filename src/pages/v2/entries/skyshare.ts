import type { APIRoute } from "astro"

import { AtpAgent } from "@atproto/api"
import {
    errorResponseFromStatus,
    resolveXrpcStatus,
    parseLimit,
} from "@/lib/api.js"
import { ENTRY_COLLECTION } from "@/lib/entry"
import { normalizeTimelineEntry, type TimelineSkyshareEntry } from "@/lib/posts"

/**
 * Skyshare v2 entries/skyshare API。
 *
 * 責務と処理概要:
 * - 自分の `dev.nekono.skyshare.entry` レコードを一覧取得する、entry 中心の API。
 * - 各entryについて、紐づく Bluesky 投稿（source）が既に削除され存在しないかどうかを
 *   `orphaned` フラグとして付与して返す。絞り込みは行わず、常に全件を返す。
 *
 * 実装上の制約:
 * - Cloudflare Workers 環境で動作するため、Node.js 固有 API は使用しない。
 */

/**
 * `app.bsky.feed.getPosts` の `uris` に一度に渡せる最大件数。
 */
const GET_POSTS_BATCH_SIZE = 25

/**
 * 指定した source URI 群のうち、Bluesky 投稿として現存するものの集合を返す。
 *
 * 処理の趣旨:
 * - `getPosts` は 25 件までのバッチ取得しかできないため、`sourceUris` を分割して呼ぶ。
 * - `getPosts` は存在しない URI をエラーにせず単純に結果から省くため、返ってきた
 *   `posts[].uri` の集合に含まれない URI が「孤立（source投稿が削除済み）」と判定できる。
 *
 * Input:
 * - `agent`: 認証済み AtpAgent
 * - `sourceUris`: 生存確認したい Bluesky 投稿の AT URI 配列
 *
 * Output:
 * - 現存する URI の集合
 *
 * 例:
 * - 入力: `["at://did/app.bsky.feed.post/a", "at://did/app.bsky.feed.post/b"]`（bが削除済み）
 * - 出力: `Set(["at://did/app.bsky.feed.post/a"])`
 */
const fetchAliveSourceUris = async (
    agent: AtpAgent,
    sourceUris: string[],
): Promise<Set<string>> => {
    const alive = new Set<string>()

    for (let i = 0; i < sourceUris.length; i += GET_POSTS_BATCH_SIZE) {
        const chunk = sourceUris.slice(i, i + GET_POSTS_BATCH_SIZE)
        if (chunk.length === 0) {
            continue
        }
        const res = await agent.getPosts({ uris: chunk })
        for (const post of res.data.posts ?? []) {
            alive.add(post.uri)
        }
    }

    return alive
}

/**
 * 自分の skyshare entry を取得する。
 *
 * 処理の趣旨:
 * - `listRecords` を1回だけ呼んでそのままページを返す。
 * - 取得したページの各entryについて `fetchAliveSourceUris` で source の生存確認を行い、
 *   生存していないものに `orphaned: true` を付与する（絞り込みは行わない）。
 *
 * Input:
 * - `agent`: 認証済み AtpAgent
 * - `did`: 対象 repo DID（自分自身）
 * - `limit`: 呼び出し元が要求する件数
 * - `cursor`: ページング開始位置（未指定可）
 *
 * Output:
 * - `entries`: 表示用に正規化した entry 配列（`orphaned` 付与済み、最大 limit 件）
 * - `cursor`: 次ページ用 cursor（存在する場合のみ）
 */
const fetchSkyshareEntries = async (
    agent: AtpAgent,
    did: string,
    limit: number,
    cursor: string | undefined,
): Promise<{ entries: TimelineSkyshareEntry[]; cursor?: string }> => {
    const res = await agent.com.atproto.repo
        .listRecords({
            repo: did,
            collection: ENTRY_COLLECTION,
            cursor,
            limit,
        })
        .then(res => res.data)

    const pageEntries = (res.records ?? [])
        .map(normalizeTimelineEntry)
        .filter((entry): entry is TimelineSkyshareEntry => entry !== undefined)

    const aliveSourceUris = await fetchAliveSourceUris(
        agent,
        pageEntries.map(entry => entry.sourceUri),
    )

    const entries = pageEntries.map(entry => ({
        ...entry,
        orphaned: !aliveSourceUris.has(entry.sourceUri),
    }))

    return { entries, cursor: res.cursor }
}

/**
 * GET /v2/entries/skyshare — 自分の skyshare entry 一覧を取得する。
 *
 * Input:
 * - Cookie に `atp_session`
 * - Query に `limit` / `cursor`（いずれも任意）
 *
 * Output:
 * - `entries`: skyshare entry 一覧（各要素に `orphaned` を付与）
 * - `cursor`: 次ページ用 cursor（存在する場合のみ）
 */
export const GET: APIRoute = async ({ request, locals }) => {
    try {
        const url = new URL(request.url)
        const rawLimit = parseLimit(url.searchParams.get("limit"))
        if (rawLimit === null) {
            return errorResponseFromStatus(400)
        }

        const limit = rawLimit ?? 20
        const cursor = url.searchParams.get("cursor") ?? undefined

        const { agent, session } = locals
        if (!agent || !session) {
            return errorResponseFromStatus(401)
        }

        const result = await fetchSkyshareEntries(
            agent,
            session.did,
            limit,
            cursor,
        )

        return new Response(
            JSON.stringify({
                cursor: result.cursor,
                entries: result.entries,
            }),
            {
                status: 200,
                headers: { "Content-Type": "application/json" },
            },
        )
    } catch (error) {
        console.error("entries/skyshare.ts GET failed", error)
        return errorResponseFromStatus(resolveXrpcStatus(error))
    }
}
