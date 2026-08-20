import type { APIRoute } from "astro"

import { AtpAgent, AppBskyFeedDefs } from "@atproto/api"
import {
    errorResponseFromStatus,
    resolveXrpcStatus,
} from "@/lib/api/response.js"
import { parseLimit } from "@/util/http"
import { ENTRY_COLLECTION } from "@/lib/entry/entry"
import {
    groupTimelineEntriesBySourceUri,
    normalizeTimelinePost,
} from "@/lib/entry/posts"
import { listAllRecords } from "@/lib/atproto/repo"

/**
 * Skyshare v2 entries API。
 *
 * 責務と処理概要:
 * - 自分の Bluesky 投稿一覧（`app.bsky.feed.getAuthorFeed`）を、紐づく
 *   `dev.nekono.skyshare.entry`（`source.uri` で突き合わせ）と embed して返す、
 *   post 中心のタイムライン一覧 API。Timeline コンポーネントが利用する。
 * - skyshare entry 自体の一覧・作成・削除は `/v2/entry`・`/v2/entries/skyshare` を参照。
 *
 * 実装上の制約:
 * - Cloudflare Workers 環境で動作するため、Node.js 固有 API は使用しない。
 */

/**
 * 1 リクエストあたりに getAuthorFeed をページングして良い最大回数。
 *
 * 趣旨:
 * - リポストなど自分以外が author の投稿を除外すると 1 ページあたりの件数が
 *   目減りするため、limit 分を満たすまで複数ページ取得する必要がある。
 * - 上限を設けないと、自分の投稿が少ないアカウントで無限にページング
 *   し続けてしまうため、上限に達した時点で取得できた分のみ返す。
 */
const MAX_AUTHOR_FEED_PAGES = 5

/**
 * `getAuthorFeed` を自分の投稿のみに絞り込んだ上で limit 件になるまで取得する。
 *
 * 処理の趣旨:
 * - `getAuthorFeed` はリポストを含みうるが、リポストの `post.author` は
 *   リポスト元の投稿者であり session の DID とは一致しない。
 * - atproto の `app.bsky.feed.defs#postView.author.did` を正とみなし、
 *   これが session の DID と一致する投稿のみを「自分の投稿」として残す。
 * - フィルタにより 1 ページの件数が limit を下回った場合は、cursor を
 *   辿って追加ページを取得し、limit 件（または取得可能な全件）まで補充する。
 *
 * Input:
 * - `agent`: 認証済み AtpAgent
 * - `did`: session の DID（自分自身）
 * - `limit`: 呼び出し元が要求する件数
 * - `cursor`: ページング開始位置（未指定可）
 *
 * Output:
 * - `feed`: 自分の投稿のみで構成された FeedViewPost 配列（最大 limit 件）
 * - `cursor`: 次ページ用 cursor（存在する場合のみ）
 */
const fetchOwnAuthorFeed = async (
    agent: AtpAgent,
    did: string,
    limit: number,
    cursor: string | undefined,
): Promise<{ feed: AppBskyFeedDefs.FeedViewPost[]; cursor?: string }> => {
    const collected: AppBskyFeedDefs.FeedViewPost[] = []
    let nextCursor = cursor

    for (let page = 0; page < MAX_AUTHOR_FEED_PAGES; page++) {
        const res = await agent
            .getAuthorFeed({
                actor: did,
                limit,
                cursor: nextCursor,
            })
            .then(res => res.data)

        collected.push(
            ...(res.feed ?? []).filter(item => item.post.author.did === did),
        )
        nextCursor = res.cursor

        if (collected.length >= limit || !nextCursor) {
            break
        }
    }

    return {
        feed: collected.slice(0, limit),
        cursor: nextCursor,
    }
}

/**
 * GET /v2/entries — 自分の Bluesky 投稿一覧を取得する。
 *
 * Input:
 * - Cookie に `atp_session`
 * - Query に `limit` / `cursor`（任意）
 *
 * Output:
 * - `posts`: 投稿一覧。該当する投稿には `skyshareEntry` を付与する。
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

        const [feedRes, rawEntries] = await Promise.all([
            fetchOwnAuthorFeed(agent, session.did, limit, cursor),
            listAllRecords(agent, {
                repo: session.did,
                collection: ENTRY_COLLECTION,
            }),
        ])

        const entriesBySourceUri = groupTimelineEntriesBySourceUri(rawEntries)
        const posts = feedRes.feed
            .map(feedItem => {
                const sourceUri = feedItem?.post?.uri
                const attachedEntry =
                    typeof sourceUri === "string"
                        ? entriesBySourceUri.get(sourceUri)
                        : undefined
                return normalizeTimelinePost(feedItem, attachedEntry)
            })
            .filter(post => post !== undefined)

        return new Response(
            JSON.stringify({
                cursor: feedRes.cursor,
                posts,
            }),
            {
                status: 200,
                headers: { "Content-Type": "application/json" },
            },
        )
    } catch (error) {
        console.error("entries.ts GET failed", error)
        return errorResponseFromStatus(resolveXrpcStatus(error))
    }
}
