import type { APIRoute } from "astro"

import { RichText } from "@atproto/api"
import {
    errorResponseFromStatus,
    resolveXrpcStatus,
} from "@/lib/api/response.js"
import { convertHeaderToObj, isMultipartFormData } from "@/util/http"
import { dropEmptyStringField } from "@/util/formData"
import { bskyPostUrlgen } from "@/lib/entry/url"
import { uploadBlob } from "@/lib/atproto/blob"
import { applyPostGate } from "@/lib/atproto/gate"
import { createBskyPost } from "@/lib/atproto/post"
import {
    createExternalEmbed,
    createImageEmbed,
    validateImageMetadata,
} from "@/lib/atproto/embed"

import * as PostSchema from "@/client/openapi/schemas/v2/bsky/record/post"

/**
 * Skyshare v2 bsky/record API。
 *
 * 責務と処理概要:
 * - skyshare entry を一切伴わない Bluesky 投稿（テキスト投稿・OGPリンク付き投稿・
 *   手動画像添付投稿）を作成する、純粋な Bluesky API bypass エンドポイント
 *   （`v2/bsky` 名前空間の原則通り、dev.nekono.skyshare.entry の作成・参照は一切行わない）。
 * - 手動画像添付投稿は、ユーザーが「画像を添付しない（skyshare entryを作成しない）」
 *   オプションを選んだ場合の経路。skyshare entry は作らないが、Bluesky への画像添付自体は行う。
 * - 画像投稿＋skyshare entry の作成は `/v2/entry` を使う。
 *
 * 実装上の制約:
 * - Cloudflare Workers 環境で動作するため、Node.js 固有 API は使用しない。
 */

/**
 * POST /v2/bsky/record — skyshare entry を伴わない Bluesky 投稿を作成する。
 *
 * 処理フロー:
 * 1. ヘッダ検証（Content-Type, Authorization）
 * 2. 認証済みセッションの取得（`bskySessionRefresh` ミドルウェアが `locals` へ供給）
 * 3. FormData 解析と構造化オブジェクト生成
 * 4. OpenAPI スキーマバリデーション（`text` のみ、`ogMeta`+`ogImage`、または `images`+`imagesMeta`）
 * 5. 手動画像添付のメタデータ検証（images 指定時）
 * 6. テキスト facet 検出
 * 7. Embed 作成（images 指定時は画像 embed、ogMeta+ogImage 指定時は外部リンク embed。
 *    両者は Bluesky 上で同時に埋め込めないため images を優先する）
 * 8. bsky 投稿作成
 * 8.5. 返信/引用設定(threadgate/postgate)の適用（`gate` 指定時のみ。失敗しても
 *      投稿自体は成功扱いとし、`gateWarning` フラグで呼び出し元へ通知する）
 * 9. 結果返却
 *
 * 入力形状(最小要件):
 * - リクエスト: multipart/form-data
 * - ヘッダ: Content-Type, Authorization
 * - フィールド: text（テキスト投稿）、ogMeta + ogImage（OGPリンク投稿, text併用可）、
 *   または images + imagesMeta（手動画像添付投稿, text併用可）。任意で `gate`。
 *
 * 出力:
 * - 成功時（200）: { url: "https://...", uri: "at://...", cid: "bafy...", gateWarning }
 * - 失敗時: 400/401/500 と エラーメッセージ
 *
 * 例:
 * - 入力: POST /v2/bsky/record + multipart(text="Hello")
 * - 出力: { url: "https://bsky.app/profile/alice.bsky.social/post/xyz", uri: "at://...", cid: "bafy..." }
 */
export const POST: APIRoute = async ({ request, locals }) => {
    try {
        // フェーズ 1: ヘッダ検証
        const rawHead = PostSchema.RequestHeaderSchema.safeParse(
            convertHeaderToObj(request.headers),
        )
        if (!rawHead.success) {
            console.warn(
                "createBskyRecord: invalid headers: " +
                    JSON.stringify(rawHead.error),
            )
            return errorResponseFromStatus(400)
        }

        // フェーズ 2: 認証済みセッションの取得
        const { agent, session } = locals
        if (!agent || !session) {
            return errorResponseFromStatus(401)
        }

        // フェーズ 3: FormData 解析
        if (!isMultipartFormData(request.headers.get("content-type"))) {
            return errorResponseFromStatus(400)
        }

        let formData: FormData
        try {
            formData = await request.formData()
        } catch (err) {
            console.warn("createBskyRecord: parseFormData failed", err)
            return errorResponseFromStatus(400)
        }

        dropEmptyStringField(formData, "text")

        // フェーズ 4: OpenAPI スキーマバリデーション
        const body = PostSchema.RequestBodySchema.safeParse(formData)
        if (!body.success) {
            console.error(
                "createBskyRecord: invalid request body: " +
                    JSON.stringify(body),
            )
            return errorResponseFromStatus(400)
        }

        // フェーズ 5: 手動画像添付のメタデータ検証
        try {
            validateImageMetadata(body.data.images, body.data.imagesMeta)
        } catch (err) {
            console.warn(
                "createBskyRecord: image metadata validation failed",
                err,
            )
            return errorResponseFromStatus(400)
        }

        // フェーズ 6: テキスト facet 検出
        const postText = body.data.text ?? ""
        const rt = new RichText({ text: postText })
        await rt.detectFacets(agent)

        // フェーズ 7: Embed 作成
        // 画像（手動添付）と OGP リンクカードは Bluesky 上で同時に埋め込めないため、
        // 画像が指定されている場合はそちらを優先する。
        let embed: any = undefined
        if (body.data.images && body.data.images.length > 0) {
            let uploadedImages: any[]
            try {
                uploadedImages = await Promise.all(
                    body.data.images.map(image => uploadBlob(agent, image)),
                )
            } catch (err) {
                console.error("createBskyRecord: image upload failed", err)
                return errorResponseFromStatus(500)
            }
            embed = createImageEmbed(uploadedImages, body.data.imagesMeta)
        } else if (body.data.ogMeta && body.data.ogImage) {
            let uploadedOgImage: any
            try {
                uploadedOgImage = await uploadBlob(agent, body.data.ogImage)
            } catch (err) {
                console.error("createBskyRecord: ogImage upload failed", err)
                return errorResponseFromStatus(500)
            }

            try {
                embed = createExternalEmbed(body.data.ogMeta, uploadedOgImage)
            } catch (err) {
                console.error("createBskyRecord: failed to create embed", err)
                return errorResponseFromStatus(400)
            }
        }

        // フェーズ 8: bsky 投稿作成
        let response: { uri: string; cid: string }
        try {
            response = await createBskyPost(
                agent,
                rt.text,
                rt.facets ?? undefined,
                body.data.langs,
                embed,
                body.data.selfLabels,
            )
        } catch (err) {
            console.error("createBskyRecord: app.bsky.feed.post failed", err)
            return errorResponseFromStatus(500)
        }

        const rkey = response.uri.split("/").slice(-1)[0]

        // フェーズ 8.5: 返信/引用設定(threadgate/postgate)の適用
        // app.bsky.feed.post 自体は既に成功済みのため、ここでの失敗は
        // リクエスト全体を失敗扱いにせず、gateWarning フラグとしてのみ反映する
        // （500を返してしまうとクライアントがリトライし、投稿が重複作成される実害の方が大きいため）。
        let gateWarning = false
        if (body.data.gate) {
            try {
                const gateResult = await applyPostGate(
                    agent,
                    session.did,
                    response.uri,
                    rkey,
                    body.data.gate,
                )
                gateWarning =
                    gateResult.threadgateFailed || gateResult.postgateFailed
                if (gateResult.threadgateFailed) {
                    console.error("createBskyRecord: threadgate create failed")
                }
                if (gateResult.postgateFailed) {
                    console.error("createBskyRecord: postgate create failed")
                }
            } catch (err) {
                console.error(
                    "createBskyRecord: gate apply unexpected error",
                    err,
                )
                gateWarning = true
            }
        }

        // フェーズ 9: 結果返却
        return new Response(
            JSON.stringify({
                url: bskyPostUrlgen(session.handle, rkey),
                uri: response.uri,
                cid: response.cid,
                gateWarning,
            }),
            {
                status: 200,
                headers: { "Content-Type": "application/json" },
            },
        )
    } catch (err: unknown) {
        console.error("createBskyRecord: create record error", err)
        return errorResponseFromStatus(resolveXrpcStatus(err))
    }
}
