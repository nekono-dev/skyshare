import type { APIRoute } from "astro"

import { DevNekonoSkyshareEntry } from "@/client/atproto"
import {
    RichText,
    AtpAgent,
    ComAtprotoServerRefreshSession,
    AppBskyEmbedImages,
    AppBskyFeedDefs,
    AppBskyFeedPost,
} from "@atproto/api"
import { parseSessionFromRequest } from "@/lib/cookies.js"
import {
    convertHeaderToObj,
    errorResponseFromStatus,
    resolveXrpcStatus,
} from "@/lib/api.js"
import { extractLinkUrisFromFacets } from "@/lib/richtext"
import { ENTRY_COLLECTION } from "@/lib/entry"
import {
    groupTimelineEntriesBySourceUri,
    normalizeTimelinePost,
} from "@/lib/posts"
import { createSkyshareEntry } from "@/lib/skyshareRecord"

import * as PostSchema from "@/client/openapi/schemas/v1/entry/post"
import * as Components from "@/client/openapi/schemas/components"
import { bskyPostUrlgen, parseAtUri } from "@/lib/url"

/**
 * Skyshare v1 entry 作成 API。
 *
 * 責務と処理概要:
 * - multipart/form-data リクエストを段階的に検証・解析する。
 * - `uri` が指定された場合は既存の Bluesky 投稿から skyshare entry を発行する（from-post 相当）。
 * - `uri` が無い場合は投稿データ（本文・画像・OGP情報）の排他条件と必須組み合わせを確認する。
 * - atproto へ投稿を作成し、条件を満たす場合は dev.nekono.skyshare.entry レコードも生成する。
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
 * 投稿種別の排他条件と必須組み合わせを検証する。
 *
 * 処理の趣旨:
 * - 3つの投稿パターンを相互排他的に検証する。
 *   1. 画像投稿: images & imagesMeta & ogImage 必須、ogMeta は禁止
 *   2. OGP 投稿: ogMeta & ogImage & テキスト内リンク 必須、images は禁止
 *   3. テキスト投稿: 上記両方の要素を含まない
 *
 * Input:
 * - `body`: OpenAPI RequestBodySchema でバリデーション済みのボディオブジェクト
 *
 * Output:
 * - void（エラー時は Error を throw）
 *
 * 失敗時の方針:
 * - 排他条件違反（images + ogMeta 両立など）は Error を throw。
 * - 必須フィールド不足は Error を throw。
 *
 * 例:
 * - 入力：{ images: [Blob], ogMeta: {...} } → throw「images と ogMeta は排他」
 * - 入力：{ images: [Blob], ogImage: null } → throw「image post requires ogImage」
 */
const validatePostTypeConstraints = (body: PostSchema.RequestBodyType) => {
    const hasImages = (body.images?.length ?? 0) > 0
    const hasOgpMeta = Boolean(body.ogMeta)
    const hasOgpImage = Boolean(body.ogImage)

    // 複数投稿パターンの排他条件を検証する。ネスト1段で if 分岐により複数条件を確認。
    if (hasImages && hasOgpMeta) {
        throw new Error(
            "request has both images and ogMeta, which is not allowed",
        )
    }

    if (!hasImages && (body.imagesMeta?.length ?? 0) > 0) {
        throw new Error("imagesMeta provided without images")
    }

    if (hasImages && !hasOgpImage) {
        throw new Error("image post requires ogImage")
    }

    if (hasOgpMeta && !hasOgpImage) {
        throw new Error("ogp post requires ogImage")
    }

    if (!hasImages && hasOgpImage && !hasOgpMeta) {
        throw new Error("ogp post requires ogMeta")
    }
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
 * - 入力：images=undefined, imagesMeta=undefined → void（非画像投稿なのでスキップ）
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
 * - `thumbBlob`: サムネイル blob（アップロード済み）
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
    ogMeta: Components.CommonOgMetaType | undefined,
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
            title: ogMeta!.title,
            description: ogMeta!.description,
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
 * - `embed`: 埋め込みオブジェクト（images または external）
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
    | { ok: true; bskyUrl: string; skyshareUri: string }
    | { ok: false; status: 400 | 404 | 500 }

/**
 * 既存の Bluesky 投稿から skyshare entry を発行する（from-post 相当の処理）。
 *
 * 処理の趣旨:
 * - `uri` の repo が session の DID と一致することを確認し、他人の投稿からの発行を防ぐ。
 * - 対象投稿を取得し、先頭の画像 blob をそのまま manifest.visual として再利用する（再アップロードは行わない）。
 * - bsky 投稿は新規作成せず、既存投稿の URL をそのまま返す。
 *
 * Input:
 * - `agent`: 認証済み AtpAgent
 * - `postUri`: 対象となる自分自身の app.bsky.feed.post の AT URI
 * - `session`: セッション情報（DID・handle 取得用）
 *
 * Output:
 * - 成功時: `{ ok: true, bskyUrl, skyshareUri }`
 * - 失敗時: `{ ok: false, status }`（400: URI 不正/画像なし、404: 投稿が見つからない、500: 発行失敗）
 */
const createEntryFromExistingPost = async (
    agent: AtpAgent,
    postUri: string,
    session: ComAtprotoServerRefreshSession.OutputSchema,
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
    const visual =
        embed?.$type === "app.bsky.embed.images"
            ? (embed as AppBskyEmbedImages.Main).images?.[0]?.image
            : undefined
    if (!visual) {
        console.warn(
            "createEntry: source post has no eligible image (from-post)",
        )
        return { ok: false, status: 400 }
    }

    const postText = typeof postRecord.text === "string" ? postRecord.text : ""
    const userName = await agent
        .getProfile({ actor: session.did })
        .then(res => res.data.displayName || session.handle)

    let skyshareUri = ""
    try {
        skyshareUri = await createSkyshareEntry(
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

    if (!skyshareUri) {
        return { ok: false, status: 500 }
    }

    return {
        ok: true,
        bskyUrl: bskyPostUrlgen(session.handle, parsedPostUri.rkey),
        skyshareUri,
    }
}

/**
 * limit クエリを検証する。
 *
 * Input:
 * - `value`: query string value
 *
 * Output:
 * - 1〜100 の整数なら number、未指定なら undefined、不正値なら null
 */
const parseLimit = (value: string | null) => {
    if (value === null || value.trim().length === 0) {
        return undefined
    }

    const parsed = Number(value)
    if (!Number.isInteger(parsed) || parsed < 1 || parsed > 100) {
        return null
    }

    return parsed
}

/**
 * multipart/form-data の入力を API 仕様に沿って正規化する。
 *
 * 処理の趣旨:
 * - `text` は空文字列が送られうるため、未指定と同義として扱えるよう除去する。
 * - OpenAPI の anyOf（text または images+imagesMeta または ogMeta）判定において、
 *   空文字が意図せず必須文字列判定を壊さないようにする。
 *
 * Input:
 * - `formData`: request.formData() で取得した生データ
 *
 * Output:
 * - 正規化後の FormData（同一インスタンスを破壊的更新）
 *
 * 例:
 * - 入力: text="" + images/imagesMeta が存在
 * - 出力: text キーを除去し、画像投稿として後続バリデーションへ渡す
 */
const normalizeEntryFormData = (formData: FormData) => {
    const rawText = formData.get("text")
    if (typeof rawText === "string" && rawText.trim().length === 0) {
        formData.delete("text")
    }
    return formData
}

/**
 * dev.nekono.skyshare.entry を全件取得する。
 *
 * Input:
 * - `agent`: 認証済み AtpAgent
 * - `repo`: 取得対象 repo DID
 *
 * Output:
 * - listRecords の records 配列
 */
const collectSkyshareEntries = async (agent: AtpAgent, repo: string) => {
    const entries: any[] = []
    let cursor: string | undefined

    do {
        const res = await agent.com.atproto.repo
            .listRecords({
                repo,
                collection: ENTRY_COLLECTION,
                cursor,
                limit: 100,
            })
            .then(res => res.data)

        entries.push(...(res.records ?? []))
        cursor = res.cursor
    } while (cursor)

    return entries
}

/**
 * POST /v1/entry — Skyshare のエントリ投稿を作成する API エンドポイント。
 *
 * 処理フロー:
 * 1. ヘッダ検証（Content-Type, Authorization）
 * 2. セッション復号と AtpAgent 初期化
 * 3. FormData 解析と構造化オブジェクト生成
 * 4. OpenAPI スキーマバリデーション
 * 4.5. `uri` 指定時は既存投稿からの発行（from-post 相当）に分岐して結果を返却
 * 5. 投稿種別の排他条件検証
 * 6. 画像メタデータ検証
 * 7. 画像アップロード（複数並列）
 * 8. テキスト facet 検出
 * 9. Embed 作成（画像投稿 or OGP 投稿）
 * 10. bsky 投稿作成
 * 11. skyshare entry 作成（画像投稿のみ）
 * 12. 結果返却
 *
 * 入力形状(最小要件):
 * - リクエスト: multipart/form-data
 * - ヘッダ: Content-Type, Authorization
 * - フィールド: uri のみ（既存投稿からの発行）、または
 *   text, [langs], [images], [imagesMeta], [ogMeta], [ogImage]（新規投稿）
 *
 * 出力:
 * - 成功時（200）: { bsky: { url: "https://..." }, skyshare: { uri: "https://..." } }
 * - 失敗時: 400/401/404/500 と エラーメッセージ
 *
 * 例:
 * - 入力: POST /v1/entry + multipart(text="Hello", images=[...], imagesMeta=[...], ogImage=[...])
 * - 出力: { bsky: { url: "https://bsky.app/profile/alice.bsky.social/post/xyz" }, skyshare: { uri: "https://skyshare.dev/did/rkey" } }
 * - 入力: POST /v1/entry + multipart(uri="at://did:plc:abc/app.bsky.feed.post/3lxyz")
 * - 出力: { bsky: { url: "https://bsky.app/profile/alice.bsky.social/post/3lxyz" }, skyshare: { uri: "https://skyshare.dev/did/rkey" } }
 */
export const POST: APIRoute = async ({ request }: { request: Request }) => {
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

        // フェーズ 2: セッション復号と AtpAgent 初期化
        let session: ComAtprotoServerRefreshSession.OutputSchema
        let service: string
        ;({ session, service } = parseSessionFromRequest(request))
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
            )
            if (!fromPostResult.ok) {
                return errorResponseFromStatus(fromPostResult.status)
            }

            return new Response(
                JSON.stringify({
                    bsky: { url: fromPostResult.bskyUrl },
                    skyshare: { uri: fromPostResult.skyshareUri },
                }),
                {
                    status: 200,
                    headers: { "Content-Type": "application/json" },
                },
            )
        }

        // フェーズ 5: 投稿種別の排他条件検証
        try {
            validatePostTypeConstraints(body.data)
        } catch (err) {
            console.error("createEntry: validation constraint failed", err)
            return errorResponseFromStatus(400)
        }

        // フェーズ 6: 画像メタデータ検証
        try {
            validateImageMetadata(body.data.images, body.data.imagesMeta)
        } catch (err) {
            console.warn("createEntry: image metadata validation failed", err)
            return errorResponseFromStatus(400)
        }

        // フェーズ 7: 画像アップロード（複数並列）
        const uploadedImages: any[] = []
        if ((body.data.images?.length ?? 0) > 0 && body.data.images) {
            try {
                uploadedImages.push(
                    ...(await Promise.all(
                        body.data.images.map(image => uploadBlob(agent, image)),
                    )),
                )
            } catch (err) {
                console.error("createEntry: image upload failed", err)
                return errorResponseFromStatus(500)
            }
        }

        // フェーズ 7.1: OGP画像（クロップ済みサムネイル）のアップロード
        let uploadedOgImage: any = undefined
        if (body.data.ogImage) {
            try {
                uploadedOgImage = await uploadBlob(agent, body.data.ogImage)
            } catch (err) {
                console.error("createEntry: ogImage upload failed", err)
                return errorResponseFromStatus(500)
            }
        }

        // フェーズ 8: テキスト facet 検出
        const postText = body.data.text ?? ""
        const rt = new RichText({ text: postText })
        await rt.detectFacets(agent)

        // フェーズ 9: Embed 作成（画像投稿 or OGP 投稿）
        let embed: any = undefined
        try {
            if (uploadedImages.length > 0) {
                // 画像投稿パターン
                embed = createImageEmbed(uploadedImages, body.data.imagesMeta)
            } else if (body.data.ogMeta && uploadedOgImage) {
                // OGP 投稿パターン
                embed = createExternalEmbed(
                    rt.facets ?? undefined,
                    body.data.ogMeta,
                    uploadedOgImage,
                )
            }
        } catch (err) {
            console.error("createEntry: failed to create embed", err)
            return errorResponseFromStatus(400)
        }

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

        // フェーズ 11: skyshare entry 作成（画像投稿のみ）
        let skyshareUri = ""
        if ((body.data.images?.length ?? 0) > 0 && body.data.ogImage) {
            try {
                const userName = await agent
                    .getProfile({ actor: session.did })
                    .then(res => res.data.displayName || session.handle)

                skyshareUri = await createSkyshareEntry(
                    agent,
                    response.uri,
                    response.cid,
                    uploadedOgImage, // ogImage（クロップ済みサムネイル）を visual として使用
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
        }

        // フェーズ 12: 結果返却
        return new Response(
            JSON.stringify({
                bsky: { url: bskyUrl },
                skyshare: { uri: skyshareUri },
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
 * 1 リクエストあたりに getAuthorFeed をページングして良い最大回数。
 *
 * 趣旨:
 * - リポストなど自分以外が author の投稿を除外すると 1 ページあたりの件数が
 *   目減りするため、limit 分を満たすまで複数ページ取得する必要がある。
 * - 上限を設けないと、自分の投稿が少ないアカウントで無限にページングし
 *   続けてしまうため、上限に達した時点で取得できた分のみ返す。
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
 * GET /v1/entry — 自分の Bluesky 投稿一覧を取得する。
 *
 * Input:
 * - Cookie に `atp_session`
 * - Query に `limit` / `cursor`（任意）
 *
 * Output:
 * - `posts`: 投稿一覧。該当する投稿には `skyshareEntry` を付与する。
 * - `cursor`: 次ページ用 cursor（存在する場合のみ）
 */
export const GET: APIRoute = async ({ request }: { request: Request }) => {
    try {
        const url = new URL(request.url)
        const rawLimit = parseLimit(url.searchParams.get("limit"))
        if (rawLimit === null) {
            return errorResponseFromStatus(400)
        }

        const limit = rawLimit ?? 20
        const cursor = url.searchParams.get("cursor") ?? undefined

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

        const [feedRes, rawEntries] = await Promise.all([
            fetchOwnAuthorFeed(agent, session.did, limit, cursor),
            collectSkyshareEntries(agent, session.did),
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
        console.error("entry.ts GET failed", error)
        return errorResponseFromStatus(resolveXrpcStatus(error))
    }
}
