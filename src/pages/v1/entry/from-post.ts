import type { APIRoute } from "astro"
import { AtpAgent, AppBskyEmbedImages, AppBskyFeedPost } from "@atproto/api"

import { parseSessionFromRequest } from "@/lib/cookies.js"
import {
    convertHeaderToObj,
    errorResponseFromStatus,
    resolveXrpcStatus,
} from "@/lib/api.js"
import { parseAtUri } from "@/lib/url"
import { createSkyshareEntry } from "@/lib/skyshareRecord"

import * as PostSchema from "@/client/openapi/schemas/v1/entry/from-post/post"

/**
 * Skyshare v1 entry (from-post) 作成 API。
 *
 * 責務と処理概要:
 * - 既に Bluesky へ投稿済みの自分の投稿を指定し、dev.nekono.skyshare.entry レコードを追加発行する。
 * - 投稿に含まれる先頭の画像 blob をそのまま manifest.visual として再利用する（再アップロードは行わない）。
 * - 入力不正時は 400、認証不備は 401、対象投稿が見つからない場合は 404、外部連携失敗は 500 を返す。
 *
 * 実装上の制約:
 * - Cloudflare Workers 環境で動作するため、Node.js 固有 API は使用しない。
 */

/**
 * POST /v1/entry/from-post — 既存の Bluesky 投稿から skyshare entry を作成する API エンドポイント。
 *
 * 入力形状(最小要件):
 * - リクエスト: application/json
 * - フィールド: `postUri`（自分自身の app.bsky.feed.post の AT URI）
 *
 * 処理の趣旨:
 * - `postUri` の repo が session の DID と一致することを確認し、他人の投稿からの発行を防ぐ。
 * - 対象投稿を取得し、画像埋め込みが無い場合は visual を用意できないため 400 を返す。
 *
 * Output:
 * - 成功時（200）: `{ skyshare: { uri: "https://..." } }`
 * - 失敗時: 400/401/404/500 とエラーメッセージ
 */
export const POST: APIRoute = async ({ request }: { request: Request }) => {
    try {
        const rawHead = PostSchema.RequestHeaderSchema.safeParse(
            convertHeaderToObj(request.headers),
        )
        if (!rawHead.success) {
            console.warn(
                "createEntryFromPost: invalid headers: " +
                    JSON.stringify(rawHead.error),
            )
            return errorResponseFromStatus(400)
        }

        const { session, service } = parseSessionFromRequest(request)
        if (!session || !service) {
            return errorResponseFromStatus(401)
        }
        const agent = new AtpAgent({ service })
        await agent.resumeSession({
            refreshJwt: session.refreshJwt,
            accessJwt: session.accessJwt,
            handle: session.handle,
            did: session.did,
            active: true,
        })

        let rawBody: unknown
        try {
            rawBody = await request.json()
        } catch (err) {
            console.warn("createEntryFromPost: invalid json body", err)
            return errorResponseFromStatus(400)
        }

        const body = PostSchema.RequestBodySchema.safeParse(rawBody)
        if (!body.success) {
            console.warn(
                "createEntryFromPost: invalid request body: " +
                    JSON.stringify(body.error),
            )
            return errorResponseFromStatus(400)
        }

        const parsedPostUri = parseAtUri(body.data.postUri)
        if (
            !parsedPostUri ||
            parsedPostUri.collection !== "app.bsky.feed.post" ||
            parsedPostUri.repo !== session.did
        ) {
            return errorResponseFromStatus(400)
        }

        let postRecordRes
        try {
            postRecordRes = await agent.com.atproto.repo.getRecord({
                repo: session.did,
                collection: "app.bsky.feed.post",
                rkey: parsedPostUri.rkey,
            })
        } catch (err) {
            console.warn("createEntryFromPost: source post not found", err)
            return errorResponseFromStatus(404)
        }

        const postCid = postRecordRes.data.cid
        const postRecord = postRecordRes.data.value as AppBskyFeedPost.Main
        if (!postCid) {
            return errorResponseFromStatus(500)
        }

        const embed = postRecord.embed
        const visual =
            embed?.$type === "app.bsky.embed.images"
                ? (embed as AppBskyEmbedImages.Main).images?.[0]?.image
                : undefined
        if (!visual) {
            console.warn(
                "createEntryFromPost: source post has no eligible image",
            )
            return errorResponseFromStatus(400)
        }

        const postText =
            typeof postRecord.text === "string" ? postRecord.text : ""
        const userName = await agent
            .getProfile({ actor: session.did })
            .then(res => res.data.displayName || session.handle)

        let skyshareUri = ""
        try {
            skyshareUri = await createSkyshareEntry(
                agent,
                body.data.postUri,
                postCid,
                visual,
                postText,
                userName,
                session,
            )
        } catch (err) {
            console.error(
                "createEntryFromPost: dev.nekono.skyshare.entry create failed",
                err,
            )
            return errorResponseFromStatus(500)
        }

        if (!skyshareUri) {
            return errorResponseFromStatus(500)
        }

        return new Response(
            JSON.stringify({ skyshare: { uri: skyshareUri } }),
            {
                status: 200,
                headers: { "Content-Type": "application/json" },
            },
        )
    } catch (err: unknown) {
        console.error("createEntryFromPost: unexpected error", err)
        return errorResponseFromStatus(resolveXrpcStatus(err))
    }
}
