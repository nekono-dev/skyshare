import type { APIRoute } from "astro"

import {
    RichText,
    AtpAgent,
    ComAtprotoServerRefreshSession,
    AppBskyEmbedImages,
    AppBskyFeedPost,
} from "@atproto/api"
import {
    convertHeaderToObj,
    errorResponseFromStatus,
    resolveXrpcStatus,
} from "@/lib/api.js"
import { ENTRY_COLLECTION } from "@/lib/entry"
import {
    createSkyshareEntry,
    updateSkyshareEntry,
    type CreatedSkyshareEntry,
} from "@/lib/skyshareRecord"

import * as PostSchema from "@/client/openapi/schemas/v2/entry/post"
import * as PutSchema from "@/client/openapi/schemas/v2/entry/put"
import * as DeleteSchema from "@/client/openapi/schemas/v2/entry/delete"
import * as Components from "@/client/openapi/schemas/components"
import { bskyPostUrlgen, parseAtUri } from "@/lib/url"

/**
 * Skyshare v2 entry API。
 *
 * 責務と処理概要:
 * - 「Bluesky投稿と、それに紐づく skyshare entry」という本アプリ固有の複合概念（entry）
 *   1件に対する作成・更新・削除を扱う。
 * - POST: `uri` が指定された場合は既存の自分の Bluesky 投稿から skyshare entry を発行する
 *   （from-post）。`uri` が無い場合は、新規に画像投稿を作成し、同時に skyshare entry も作成する
 *   （このエンドポイントで作成する新規投稿は常に画像投稿であり、常に entry を伴う。
 *   entry を伴わない投稿＝テキスト投稿・OGP投稿は `/v2/bsky/record` を使う）。
 * - PUT: skyshare entry の manifest.heading/caption を更新する
 *   （主に、紐づく Bluesky 投稿が削除済みの「孤立entry」の編集用途）。
 * - DELETE: skyshare entry を削除する。`deleteBskyPost` 指定時は紐づく Bluesky 投稿も削除する。
 * - 入力不正時は 400、認証不備は 401、対象投稿が見つからない場合は 404、外部連携失敗は 500 を返す。
 *
 * 実装上の制約:
 * - Cloudflare Workers 環境で動作するため、Node.js 固有 API は使用しない。
 * - 画像アップロード・facet 検出・外部 API 呼び出しを含む副作用が複数発生する。
 */

/**
 * 画像 Blob を atproto にアップロードし、投稿埋め込み用 blob 参照を返す。
 *
 * 処理の趣旨:
 * - Blob を Uint8Array へ変換し、MIME タイプを付与して uploadBlob を呼び出す。
 * - 副作用: atproto 外部 API（uploadBlob）を呼び出してアップロードを実行。
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
 * 画像投稿時のメタデータ整合性を検証する。
 *
 * 処理の趣旨:
 * - bsky 投稿作成前に、画像投稿として成立する最小条件を確認する。
 * - images が未指定または空配列の場合は画像投稿ではないため、検証をスキップする。
 * - images が存在する場合は imagesMeta が必須であり、件数一致を確認する。
 *
 * Input:
 * - `images`: Blob 配列（undefined 可）
 * - `imagesMeta`: { width: number, height: number }[] 配列（undefined 可）
 *
 * Output:
 * - void（エラー時は Error を throw）
 *
 * 失敗時の方針:
 * - images があるのに imagesMeta がない場合は Error を throw。
 * - カウント不一致は Error を throw し、呼び出し元で catch して 400 を返す。
 *
 * 例:
 * - 入力：images=[BlobA, BlobB], imagesMeta=[{w:100,h:100}] → throw「カウント不一致」
 * - 入力：images=[BlobA, BlobB], imagesMeta=[{w:100,h:100}, {w:200,h:200}] → void
 */
const validateImageMetadata = (
    images: Blob[] | undefined,
    imagesMeta: Components.CommonImagesMetaType | undefined,
) => {
    if (!images || images.length === 0) {
        return
    }

    if (!imagesMeta) {
        throw new Error("imagesMeta is required when images are provided")
    }

    const widths = imagesMeta?.map(v => v.width) ?? []
    const heights = imagesMeta?.map(v => v.height) ?? []

    if (widths.length !== images.length || heights.length !== images.length) {
        throw new Error("image size metadata count mismatch")
    }
}

/**
 * 画像投稿の app.bsky.embed.images embed オブジェクトを組み立てる。
 *
 * 処理の趣旨:
 * - アップロード済み blob と メタデータ（幅・高さ）から、
 *   atproto の投稿埋め込み形式に適合した embed 構造を生成。
 * - aspetRatio は メタデータが存在する場合のみセット。
 *
 * Input:
 * - `uploadedBlobs`: atproto サーバーで生成された blob 参照配列
 * - `metadata`: { width: number, height: number }[] メタデータ配列
 *
 * Output:
 * - { $type: "app.bsky.embed.images", images: [...] }
 *
 * 例:
 * - 入力：uploadedBlobs=[blobRef1, blobRef2], metadata=[{w:100,h:100}, {w:200,h:200}]
 * - 出力：{ $type: "app.bsky.embed.images", images: [{image: blobRef1, alt: "", aspectRatio: {width: 100, height: 100}}, ...] }
 */
const createImageEmbed = (
    uploadedBlobs: any[],
    metadata: Components.CommonImagesMetaType | undefined,
) => {
    const widths = metadata?.map(v => v.width) ?? []
    const heights = metadata?.map(v => v.height) ?? []

    return {
        $type: "app.bsky.embed.images" as const,
        images: uploadedBlobs.map((blob, idx) => ({
            image: blob,
            alt: "",
            aspectRatio:
                widths[idx] && heights[idx]
                    ? {
                          width: widths[idx],
                          height: heights[idx],
                      }
                    : undefined,
        })),
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
 * - `embed`: 埋め込みオブジェクト
 * - `selfLabel`: 自己ラベル値（未指定時は undefined）
 *
 * Output:
 * - { uri: string, cid: string } — 投稿の URI と CID
 *
 * 失敗時の方針:
 * - agent.post が失敗した場合は Error を throw。呼び出し元で catch して 500 を返す。
 *
 * 例:
 * - 入力：agent(Auth済み),text="Hello world",facets=[],langs=["ja"],embed={$type:"..."},selfLabel="sexual"
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
    // selfLabel が指定されている場合は com.atproto.label.defs#selfLabels 形式に変換する
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
 * `uri` 指定時（from-post 相当）のレスポンス種別。
 */
type FromPostResult =
    | { ok: true; bskyUrl: string; skyshareEntry: CreatedSkyshareEntry }
    | { ok: false; status: 400 | 404 | 500 }

/**
 * 既存の Bluesky 投稿から skyshare entry を発行する（from-post 相当の処理）。
 *
 * 処理の趣旨:
 * - `uri` の repo が session の DID と一致することを確認し、他人の投稿からの発行を防ぐ。
 * - 対象投稿が画像投稿であることを確認した上で、クライアントが元投稿の全画像から
 *   デフォルト配置（クロップ編集なし）で合成した `ogImage` をアップロードし、
 *   その blob 参照を manifest.visual として採用する（先頭画像の直接流用はしない）。
 * - bsky 投稿は新規作成せず、既存投稿の URL をそのまま返す。
 *
 * Input:
 * - `agent`: 認証済み AtpAgent
 * - `postUri`: 対象となる自分自身の app.bsky.feed.post の AT URI
 * - `session`: セッション情報（DID・handle 取得用）
 * - `ogImage`: クライアントが合成したサムネイル Blob（必須）
 *
 * Output:
 * - 成功時: `{ ok: true, bskyUrl, skyshareUri }`
 * - 失敗時: `{ ok: false, status }`（400: URI 不正/画像なし/ogImage欠落、404: 投稿が見つからない、500: 発行失敗）
 */
const createEntryFromExistingPost = async (
    agent: AtpAgent,
    postUri: string,
    session: ComAtprotoServerRefreshSession.OutputSchema,
    ogImage: Blob | undefined,
): Promise<FromPostResult> => {
    const parsedPostUri = parseAtUri(postUri)
    if (
        !parsedPostUri ||
        parsedPostUri.collection !== "app.bsky.feed.post" ||
        parsedPostUri.repo !== session.did
    ) {
        return { ok: false, status: 400 }
    }

    let postRecordRes
    try {
        postRecordRes = await agent.com.atproto.repo.getRecord({
            repo: session.did,
            collection: "app.bsky.feed.post",
            rkey: parsedPostUri.rkey,
        })
    } catch (err) {
        console.warn("createEntry: source post not found (from-post)", err)
        return { ok: false, status: 404 }
    }

    const postCid = postRecordRes.data.cid
    const postRecord = postRecordRes.data.value as AppBskyFeedPost.Main
    if (!postCid) {
        return { ok: false, status: 500 }
    }

    const embed = postRecord.embed
    const hasEligibleImage =
        embed?.$type === "app.bsky.embed.images" &&
        ((embed as AppBskyEmbedImages.Main).images?.length ?? 0) > 0
    if (!hasEligibleImage) {
        console.warn(
            "createEntry: source post has no eligible image (from-post)",
        )
        return { ok: false, status: 400 }
    }

    if (!ogImage) {
        console.warn("createEntry: ogImage is required (from-post)")
        return { ok: false, status: 400 }
    }

    let visual
    try {
        visual = await uploadBlob(agent, ogImage)
    } catch (err) {
        console.error("createEntry: ogImage upload failed (from-post)", err)
        return { ok: false, status: 500 }
    }

    const postText = typeof postRecord.text === "string" ? postRecord.text : ""
    const userName = await agent
        .getProfile({ actor: session.did })
        .then(res => res.data.displayName || session.handle)

    let skyshareEntry: CreatedSkyshareEntry | undefined
    try {
        skyshareEntry = await createSkyshareEntry(
            agent,
            postUri,
            postCid,
            visual,
            postText,
            userName,
            session,
        )
    } catch (err) {
        console.error(
            "createEntry: dev.nekono.skyshare.entry create failed (from-post)",
            err,
        )
        return { ok: false, status: 500 }
    }

    if (!skyshareEntry) {
        return { ok: false, status: 500 }
    }

    return {
        ok: true,
        bskyUrl: bskyPostUrlgen(session.handle, parsedPostUri.rkey),
        skyshareEntry,
    }
}

/**
 * `CreatedSkyshareEntry` をレスポンス（`skyshare` フィールド）用の形へ変換する。
 *
 * 処理の趣旨:
 * - クライアントが作成直後にフルリロード無しで削除ボタン等を出し分けられるよう、
 *   AT URI を含む詳細情報を含める。
 *
 * Input:
 * - `entry`: `createSkyshareEntry` が返した詳細情報
 *
 * Output:
 * - レスポンス JSON の `skyshare` フィールド値
 */
const serializeSkyshareEntry = (entry: CreatedSkyshareEntry) => ({
    uri: entry.webUrl,
    atUri: entry.atUri,
    cid: entry.cid,
    createdAt: entry.createdAt,
    sourceUri: entry.sourceUri,
    sourceCid: entry.sourceCid,
    heading: entry.heading,
    caption: entry.caption,
    visualUrl: entry.visualUrl,
})

/**
 * multipart/form-data の入力を API 仕様に沿って正規化する。
 *
 * 処理の趣旨:
 * - `text` は空文字列が送られうるため、未指定と同義として扱えるよう除去する。
 * - OpenAPI の anyOf（uri+ogImage または images+imagesMeta+ogImage）判定において、
 *   空文字が意図せず `text` の min(1) 制約を壊さないようにする。
 *
 * Input:
 * - `formData`: request.formData() で取得した生データ
 *
 * Output:
 * - 正規化後の FormData（同一インスタンスを破壊的更新）
 *
 * 例:
 * - 入力: text="" + images/imagesMeta が存在
 * - 出力: text キーを除去して後続バリデーションへ渡す
 */
const normalizeEntryFormData = (formData: FormData) => {
    const rawText = formData.get("text")
    if (typeof rawText === "string" && rawText.trim().length === 0) {
        formData.delete("text")
    }
    return formData
}

/**
 * POST /v2/entry — 画像投稿＋skyshare entry を新規作成する、または既存投稿から
 * skyshare entry を発行する（`uri` 指定時、from-post）API エンドポイント。
 *
 * 処理フロー:
 * 1. ヘッダ検証（Content-Type, Authorization）
 * 2. 認証済みセッションの取得（`bskySessionRefresh` ミドルウェアが `locals` へ供給）
 * 3. FormData 解析と構造化オブジェクト生成
 * 4. OpenAPI スキーマバリデーション
 * 4.5. `uri` 指定時は既存投稿からの発行（from-post 相当）に分岐して結果を返却
 * 5. 画像投稿として成立する最小条件を確認（スキーマの anyOf で保証されるが、
 *    TypeScript の推論型は optional のままのため実行時にも確認する）
 * 6. 画像メタデータ検証
 * 7. 画像アップロード（複数並列）
 * 7.1. manifest.visual 用サムネイルのアップロード
 * 8. テキスト facet 検出
 * 9. Embed 作成（画像投稿）
 * 10. bsky 投稿作成
 * 11. skyshare entry 作成
 * 12. 結果返却
 *
 * 入力形状(最小要件):
 * - リクエスト: multipart/form-data
 * - ヘッダ: Content-Type, Authorization
 * - フィールド: uri + ogImage（既存投稿からの発行）、または
 *   images, imagesMeta, ogImage, [text], [langs], [selfLabels]（新規画像投稿）
 *
 * 出力:
 * - 成功時（200）: { bsky: { url: "https://..." }, skyshare: { uri: "https://...", atUri, cid, ... } }
 * - 失敗時: 400/401/404/500 と エラーメッセージ
 *
 * 例:
 * - 入力: POST /v2/entry + multipart(text="Hello", images=[...], imagesMeta=[...], ogImage=[...])
 * - 出力: { bsky: { url: "https://bsky.app/profile/alice.bsky.social/post/xyz" }, skyshare: { uri: "https://skyshare.dev/did/rkey", ... } }
 * - 入力: POST /v2/entry + multipart(uri="at://did:plc:abc/app.bsky.feed.post/3lxyz", ogImage=[...])
 * - 出力: { bsky: { url: "https://bsky.app/profile/alice.bsky.social/post/3lxyz" }, skyshare: { uri: "https://skyshare.dev/did/rkey", ... } }
 */
export const POST: APIRoute = async ({ request, locals }) => {
    try {
        // フェーズ 1: ヘッダ検証
        const rawHead = PostSchema.RequestHeaderSchema.safeParse(
            convertHeaderToObj(request.headers),
        )
        if (!rawHead.success) {
            console.warn(
                "createEntry: invalid headers: " +
                    JSON.stringify(rawHead.error),
            )
            return errorResponseFromStatus(400)
        }

        // フェーズ 2: 認証済みセッションの取得（ミドルウェアが解決済み）
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
            console.warn("createEntry: parseFormData failed", err)
            return errorResponseFromStatus(400)
        }

        normalizeEntryFormData(formData)

        // フェーズ 4: OpenAPI スキーマバリデーション
        const body = PostSchema.RequestBodySchema.safeParse(formData)
        if (!body.success) {
            console.error(
                "createEntry: invalid request body: " + JSON.stringify(body),
            )
            return errorResponseFromStatus(400)
        }

        // フェーズ 4.5: uri 指定時は既存投稿からの発行（from-post 相当）に分岐する
        if (body.data.uri) {
            const fromPostResult = await createEntryFromExistingPost(
                agent,
                body.data.uri,
                session,
                body.data.ogImage,
            )
            if (!fromPostResult.ok) {
                return errorResponseFromStatus(fromPostResult.status)
            }

            return new Response(
                JSON.stringify({
                    bsky: { url: fromPostResult.bskyUrl },
                    skyshare: serializeSkyshareEntry(
                        fromPostResult.skyshareEntry,
                    ),
                }),
                {
                    status: 200,
                    headers: { "Content-Type": "application/json" },
                },
            )
        }

        // フェーズ 5: 画像投稿として成立する最小条件を確認
        if (
            !body.data.images ||
            body.data.images.length === 0 ||
            !body.data.ogImage
        ) {
            console.error(
                "createEntry: images/ogImage missing for new post (unexpected, schema should have rejected this)",
            )
            return errorResponseFromStatus(400)
        }
        const images = body.data.images
        const ogImage = body.data.ogImage

        // フェーズ 6: 画像メタデータ検証
        try {
            validateImageMetadata(images, body.data.imagesMeta)
        } catch (err) {
            console.warn("createEntry: image metadata validation failed", err)
            return errorResponseFromStatus(400)
        }

        // フェーズ 7: 画像アップロード（複数並列）
        let uploadedImages: any[]
        try {
            uploadedImages = await Promise.all(
                images.map(image => uploadBlob(agent, image)),
            )
        } catch (err) {
            console.error("createEntry: image upload failed", err)
            return errorResponseFromStatus(500)
        }

        // フェーズ 7.1: manifest.visual 用サムネイルのアップロード
        let uploadedOgImage: any
        try {
            uploadedOgImage = await uploadBlob(agent, ogImage)
        } catch (err) {
            console.error("createEntry: ogImage upload failed", err)
            return errorResponseFromStatus(500)
        }

        // フェーズ 8: テキスト facet 検出
        const postText = body.data.text ?? ""
        const rt = new RichText({ text: postText })
        await rt.detectFacets(agent)

        // フェーズ 9: Embed 作成（画像投稿）
        const embed = createImageEmbed(uploadedImages, body.data.imagesMeta)

        // フェーズ 10: bsky 投稿作成
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
            console.error("createEntry: app.bsky.feed.post failed", err)
            return errorResponseFromStatus(500)
        }

        const rkey = response.uri.split("/").slice(-1)[0]
        const bskyUrl = bskyPostUrlgen(session.handle, rkey)

        // フェーズ 11: skyshare entry 作成
        let skyshareEntry: CreatedSkyshareEntry | undefined
        try {
            const userName = await agent
                .getProfile({ actor: session.did })
                .then(res => res.data.displayName || session.handle)

            skyshareEntry = await createSkyshareEntry(
                agent,
                response.uri,
                response.cid,
                uploadedOgImage,
                postText,
                userName,
                session,
            )
        } catch (err) {
            console.error(
                "createEntry: dev.nekono.skyshare.entry create failed",
                err,
            )
            return errorResponseFromStatus(500)
        }

        if (!skyshareEntry) {
            return errorResponseFromStatus(500)
        }

        // フェーズ 12: 結果返却
        return new Response(
            JSON.stringify({
                bsky: { url: bskyUrl },
                skyshare: serializeSkyshareEntry(skyshareEntry),
            }),
            {
                status: 200,
                headers: { "Content-Type": "application/json" },
            },
        )
    } catch (err: unknown) {
        console.error("createEntry: create entry error", err)
        return errorResponseFromStatus(resolveXrpcStatus(err))
    }
}

/**
 * PUT /v2/entry — skyshare entry の heading/caption を更新する。
 *
 * 処理フロー:
 * 1. ヘッダ検証（セッション取得はミドルウェアが解決済み）
 * 2. ボディ検証、`uri` が自分自身の dev.nekono.skyshare.entry であることを確認
 * 3. 対象レコードを取得し、source/manifest.visual/createdAt はそのまま維持しつつ
 *    manifest.heading/caption のみ差し替えて putRecord する
 *    （atproto に部分更新はないため、レコード全体を書き直す）。
 *    取得時の cid を swapRecord に指定し、取得後に他リクエストが更新した
 *    場合の競合を検出する。
 *
 * Input:
 * - `request`: cookie と `{ uri, heading, caption }` を含む HTTP リクエスト
 *
 * Output:
 * - 200: 本文なし
 * - 4xx/5xx: 共通エラー JSON
 *
 * 例:
 * - 入力: `{ "uri": "at://did:plc:abc/dev.nekono.skyshare.entry/3lxyz", "heading": "旅行", "caption": "京都にて" }`
 * - 出力: `status 200`
 */
export const PUT: APIRoute = async ({ request, locals }) => {
    try {
        const rawHead = PutSchema.RequestHeaderSchema.safeParse(
            convertHeaderToObj(request.headers),
        )
        if (!rawHead.success) {
            return errorResponseFromStatus(400)
        }

        const { agent, session } = locals
        if (!agent || !session) {
            return errorResponseFromStatus(401)
        }

        let json: unknown
        try {
            json = await request.json()
        } catch (err) {
            console.warn("updateEntry: invalid JSON body", err)
            return errorResponseFromStatus(400)
        }

        const body = PutSchema.RequestBodySchema.safeParse(json)
        if (!body.success) {
            return errorResponseFromStatus(400)
        }

        const parsedEntryUri = parseAtUri(body.data.uri)
        if (
            !parsedEntryUri ||
            parsedEntryUri.collection !== ENTRY_COLLECTION ||
            parsedEntryUri.repo !== session.did
        ) {
            return errorResponseFromStatus(400)
        }

        await updateSkyshareEntry(
            agent,
            session.did,
            parsedEntryUri.rkey,
            body.data.heading,
            body.data.caption,
        )

        return new Response(undefined, { status: 200 })
    } catch (error) {
        console.error("updateEntry: update entry error", error)
        return errorResponseFromStatus(resolveXrpcStatus(error))
    }
}

/**
 * DELETE /v2/entry — skyshare entry を削除する。
 *
 * 処理フロー:
 * 1. ヘッダ検証（セッション取得はミドルウェアが解決済み）
 * 2. ボディ検証、`uri` が自分自身の dev.nekono.skyshare.entry であることを確認
 * 3. `deleteBskyPost` 指定時は、事前に entry レコードを取得して source（元投稿）の
 *    URI を取得する。クライアント指定の URI をそのまま信用せず、レコードに
 *    記録された source から削除対象を導出することで他人の投稿削除を防ぐ。
 * 4. skyshare entry レコードを削除する。
 * 5. `deleteBskyPost` が true かつ source が自分自身の app.bsky.feed.post の場合、
 *    その投稿も削除する。失敗しても entry 削除自体は成功として扱う。
 *
 * Input:
 * - `request`: cookie と `{ uri, deleteBskyPost? }` を含む HTTP リクエスト
 *
 * Output:
 * - 200: 本文なし
 * - 4xx/5xx: 共通エラー JSON
 *
 * 例:
 * - 入力: `{ "uri": "at://did:plc:abc/dev.nekono.skyshare.entry/3lxyz" }`
 * - 出力: `status 200`（skyshare entry のみ削除、bsky 投稿は残る）
 */
export const DELETE: APIRoute = async ({ request, locals }) => {
    try {
        const rawHead = DeleteSchema.RequestHeaderSchema.safeParse(
            convertHeaderToObj(request.headers),
        )
        if (!rawHead.success) {
            return errorResponseFromStatus(400)
        }

        const { agent, session } = locals
        if (!agent || !session) {
            return errorResponseFromStatus(401)
        }

        let json: unknown
        try {
            json = await request.json()
        } catch (err) {
            console.warn("deleteEntry: invalid JSON body", err)
            return errorResponseFromStatus(400)
        }

        const body = DeleteSchema.RequestBodySchema.safeParse(json)
        if (!body.success) {
            return errorResponseFromStatus(400)
        }

        const parsedEntryUri = parseAtUri(body.data.uri)
        if (
            !parsedEntryUri ||
            parsedEntryUri.collection !== ENTRY_COLLECTION ||
            parsedEntryUri.repo !== session.did
        ) {
            return errorResponseFromStatus(400)
        }

        // deleteBskyPost 指定時のみ、削除前に entry レコードから source（元投稿）を取得する。
        let sourceUri: string | undefined
        if (body.data.deleteBskyPost) {
            try {
                const entryRecordRes = await agent.com.atproto.repo.getRecord({
                    repo: session.did,
                    collection: ENTRY_COLLECTION,
                    rkey: parsedEntryUri.rkey,
                })
                const entryValue = entryRecordRes.data.value as {
                    source?: { uri?: string }
                }
                sourceUri =
                    typeof entryValue?.source?.uri === "string"
                        ? entryValue.source.uri
                        : undefined
            } catch (err) {
                console.warn("deleteEntry: entry not found before delete", err)
                return errorResponseFromStatus(404)
            }
        }

        await agent.com.atproto.repo.deleteRecord({
            repo: session.did,
            collection: ENTRY_COLLECTION,
            rkey: parsedEntryUri.rkey,
        })

        if (body.data.deleteBskyPost && sourceUri) {
            const parsedSourceUri = parseAtUri(sourceUri)
            if (
                parsedSourceUri &&
                parsedSourceUri.collection === "app.bsky.feed.post" &&
                parsedSourceUri.repo === session.did
            ) {
                try {
                    await agent.com.atproto.repo.deleteRecord({
                        repo: session.did,
                        collection: "app.bsky.feed.post",
                        rkey: parsedSourceUri.rkey,
                    })
                } catch (err) {
                    // entry 自体の削除は既に成功しているため、bsky 投稿削除の失敗で
                    // リクエスト全体を失敗扱いにはしない。
                    console.error(
                        "deleteEntry: failed to delete source bsky post",
                        err,
                    )
                }
            }
        }

        return new Response(undefined, { status: 200 })
    } catch (error) {
        console.error("deleteEntry: delete entry error", error)
        return errorResponseFromStatus(resolveXrpcStatus(error))
    }
}
