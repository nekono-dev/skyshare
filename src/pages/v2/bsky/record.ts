import type { APIRoute } from "astro"

import { RichText, AtpAgent } from "@atproto/api"
import {
    errorResponseFromStatus,
    resolveXrpcStatus,
} from "@/lib/api/response.js"
import { convertHeaderToObj } from "@/util/http"
import { extractLinkUrisFromFacets } from "@/lib/atproto/richtext"
import { bskyPostUrlgen } from "@/lib/entry/url"

import * as PostSchema from "@/client/openapi/schemas/v2/bsky/record/post"
import * as Components from "@/client/openapi/schemas/components"

/**
 * Skyshare v2 bsky/record API。
 *
 * 責務と処理概要:
 * - skyshare entry を一切伴わない Bluesky 投稿（テキスト投稿・OGPリンク付き投稿）を作成する、
 *   純粋な Bluesky API bypass エンドポイント（`v2/bsky` 名前空間の原則通り、
 *   dev.nekono.skyshare.entry の作成・参照は一切行わない）。
 * - 画像投稿＋skyshare entry の作成は `/v2/entry` を使う。
 *
 * 実装上の制約:
 * - Cloudflare Workers 環境で動作するため、Node.js 固有 API は使用しない。
 */

/**
 * 画像 Blob を atproto にアップロードし、投稿埋め込み用 blob 参照を返す。
 *
 * Input:
 * - `agent`: 認証済み AtpAgent
 * - `blob`: アップロード対象画像データ
 *
 * Output:
 * - atproto の投稿埋め込みで利用可能な blob 参照オブジェクト
 *
 * 失敗時の方針:
 * - uploadBlob が例外を発生させた場合、呼び出し元で catch して 500 を返す。
 *
 * 例:
 * - 入力: `uploadBlob(authenticatedAgent, imageBlobData)`
 * - 出力: `{ $type: 'blob', link: { ... }, mimeType: 'image/jpeg' }`
 */
const uploadBlob = async (agent: AtpAgent, blob: Blob) => {
    const mime = blob.type || "application/octet-stream"
    const buffer = new Uint8Array(await blob.arrayBuffer())
    const uploadRes = await agent.uploadBlob(buffer, {
        encoding: mime,
    })
    return uploadRes.data.blob
}

/**
 * OGP 投稿の app.bsky.embed.external embed オブジェクトを組み立てる。
 *
 * 処理の趣旨:
 * - facets から テキスト内のリンク URI を抽出し、
 * - OGP メタデータ（title, description）を合成して、
 * - atproto の external embed 形式に変換する。
 *
 * Input:
 * - `facets`: RichText より生成された facets（リンク抽出用）
 * - `ogMeta`: { title: string, description: string, ... }
 * - `thumbBlob`: サムネイル blob（アップロード済み、未指定可）
 *
 * Output:
 * - { $type: "app.bsky.embed.external", external: { uri, title, description, thumb? } }
 *
 * 失敗時の方針:
 * - リンク URI が見つからない場合は Error を throw。
 *
 * 例:
 * - 入力：facets=[...], ogMeta={title:"Example",description:"..."},thumbBlob=blobRef
 * - 出力：{ $type:"app.bsky.embed.external",external:{uri:"https://...",title:"Example",description:"..."，thumb:blobRef} }
 */
const createExternalEmbed = (
    facets: any[] | undefined,
    ogMeta: Components.CommonOgMetaType,
    thumbBlob: any,
) => {
    const linkUris = extractLinkUrisFromFacets(facets)
    const externalUri = linkUris[0]

    if (!externalUri) {
        throw new Error("ogp post requires a link in the text")
    }

    return {
        $type: "app.bsky.embed.external" as const,
        external: {
            uri: externalUri,
            title: ogMeta.title,
            description: ogMeta.description,
            thumb: thumbBlob,
        },
    }
}

/**
 * atproto へ投稿を作成する。
 *
 * 処理の趣旨:
 * - AtpAgent の post メソッドを呼び出し、app.bsky.feed.post レコードを作成。
 * - selfLabel が指定された場合は com.atproto.label.defs#selfLabels 形式で labels を付与。
 * - 副作用: atproto 外部 API を呼び出して投稿を作成。
 *
 * Input:
 * - `agent`: 認証済み AtpAgent
 * - `text`: 投稿本文テキスト
 * - `facets`: 検出済みの facets 配列（リンク・mention 情報）
 * - `langs`: 言語タグ配列
 * - `embed`: 埋め込みオブジェクト（外部リンク embed、未指定可）
 * - `selfLabel`: 自己ラベル値（未指定時は undefined）
 *
 * Output:
 * - { uri: string, cid: string } — 投稿の URI と CID
 *
 * 失敗時の方針:
 * - agent.post が失敗した場合は Error を throw。呼び出し元で catch して 500 を返す。
 *
 * 例:
 * - 入力：agent(Auth済み),text="Hello world",facets=[],langs=["ja"],embed=undefined,selfLabel="sexual"
 * - 出力：{ uri:"at://did:plc:xxx/app.bsky.feed.post/xxxxx",cid:"bafy..." }
 */
const createBskyPost = async (
    agent: AtpAgent,
    text: string,
    facets: any[] | undefined,
    langs: string[] | undefined,
    embed: any,
    selfLabel: string | undefined,
) => {
    const labels = selfLabel
        ? {
              $type: "com.atproto.label.defs#selfLabels",
              values: [{ val: selfLabel }],
          }
        : undefined

    return await agent.post({
        $type: "app.bsky.feed.post",
        text,
        facets: facets ?? undefined,
        langs,
        embed,
        labels,
        via: "Skyshare",
    })
}

/**
 * multipart/form-data の入力を API 仕様に沿って正規化する。
 *
 * 処理の趣旨:
 * - `text` は空文字列が送られうるため、未指定と同義として扱えるよう除去する。
 * - OpenAPI の anyOf（text または ogMeta+ogImage）判定において、
 *   空文字が意図せず `text` の min(1) 制約を壊さないようにする。
 *
 * Input:
 * - `formData`: request.formData() で取得した生データ
 *
 * Output:
 * - 正規化後の FormData（同一インスタンスを破壊的更新）
 *
 * 例:
 * - 入力: text="" + ogMeta/ogImage が存在
 * - 出力: text キーを除去して後続バリデーションへ渡す
 */
const normalizeRecordFormData = (formData: FormData) => {
    const rawText = formData.get("text")
    if (typeof rawText === "string" && rawText.trim().length === 0) {
        formData.delete("text")
    }
    return formData
}

/**
 * POST /v2/bsky/record — skyshare entry を伴わない Bluesky 投稿を作成する。
 *
 * 処理フロー:
 * 1. ヘッダ検証（Content-Type, Authorization）
 * 2. 認証済みセッションの取得（`bskySessionRefresh` ミドルウェアが `locals` へ供給）
 * 3. FormData 解析と構造化オブジェクト生成
 * 4. OpenAPI スキーマバリデーション（`text` のみ、または `ogMeta`+`ogImage`）
 * 5. OGP サムネイルのアップロード（指定時）
 * 6. テキスト facet 検出
 * 7. Embed 作成（OGP 投稿の場合のみ）
 * 8. bsky 投稿作成
 * 9. 結果返却
 *
 * 入力形状(最小要件):
 * - リクエスト: multipart/form-data
 * - ヘッダ: Content-Type, Authorization
 * - フィールド: text（テキスト投稿）、または ogMeta + ogImage（OGPリンク投稿, text併用可）
 *
 * 出力:
 * - 成功時（200）: { url: "https://...", uri: "at://...", cid: "bafy..." }
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
        const contentType = request.headers.get("content-type") || ""
        if (!contentType.includes("multipart/form-data")) {
            return errorResponseFromStatus(400)
        }

        let formData: FormData
        try {
            formData = await request.formData()
        } catch (err) {
            console.warn("createBskyRecord: parseFormData failed", err)
            return errorResponseFromStatus(400)
        }

        normalizeRecordFormData(formData)

        // フェーズ 4: OpenAPI スキーマバリデーション
        const body = PostSchema.RequestBodySchema.safeParse(formData)
        if (!body.success) {
            console.error(
                "createBskyRecord: invalid request body: " +
                    JSON.stringify(body),
            )
            return errorResponseFromStatus(400)
        }

        // フェーズ 5: OGP サムネイルのアップロード（指定時）
        let uploadedOgImage: any = undefined
        if (body.data.ogImage) {
            try {
                uploadedOgImage = await uploadBlob(agent, body.data.ogImage)
            } catch (err) {
                console.error("createBskyRecord: ogImage upload failed", err)
                return errorResponseFromStatus(500)
            }
        }

        // フェーズ 6: テキスト facet 検出
        const postText = body.data.text ?? ""
        const rt = new RichText({ text: postText })
        await rt.detectFacets(agent)

        // フェーズ 7: Embed 作成（OGP 投稿の場合のみ）
        let embed: any = undefined
        if (body.data.ogMeta && uploadedOgImage) {
            try {
                embed = createExternalEmbed(
                    rt.facets ?? undefined,
                    body.data.ogMeta,
                    uploadedOgImage,
                )
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

        // フェーズ 9: 結果返却
        return new Response(
            JSON.stringify({
                url: bskyPostUrlgen(session.handle, rkey),
                uri: response.uri,
                cid: response.cid,
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
