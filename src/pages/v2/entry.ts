import type { APIRoute } from "astro"

import {
    errorResponseFromStatus,
    resolveXrpcStatus,
} from "@/lib/api/response.js"
import { convertHeaderToObj, isMultipartFormData } from "@/util/http"
import { formDataToObject } from "@/util/formData"
import { ENTRY_COLLECTION } from "@/lib/entry/entry"
import {
    updateSkyshareEntry,
    type CreatedSkyshareEntry,
} from "@/lib/entry/skyshareRecord"
import { uploadBlob } from "@/lib/atproto/blob"
import { isReplyRefOwnedBySelf } from "@/lib/atproto/post"
import { validateFacets } from "@/lib/atproto/facet"
import { resolveDisplayName } from "@/lib/atproto/profile"
import {
    createExternalEmbed,
    createImageEmbed,
    validateImageMetadata,
} from "@/lib/atproto/embed"
import { createEntryFromExistingPost } from "@/lib/entry/fromPost"
import {
    createBskyThread,
    type ThreadPostInput,
} from "@/lib/entry/createBskyThread"

import * as PostSchema from "@/lib/api/schema/v2/entry/post"
import * as PutSchema from "@/lib/api/schema/v2/entry/put"
import * as DeleteSchema from "@/lib/api/schema/v2/entry/delete"
import { bskyPostUrlgen, parseOwnedAtUri } from "@/lib/entry/url"

/**
 * Skyshare v2 entry API。
 *
 * 責務と処理概要:
 * - Bluesky投稿（テキスト/OGPリンク/画像。1件、またはスレッドとして複数件）の作成と、
 *   各投稿に紐づく skyshare entry（`createEntry`フラグ指定時、画像投稿のみ）の作成を扱う、
 *   統合エンドポイント（旧`/v2/bsky/record`はこのエンドポイントに統合され廃止された）。
 * - POST: `uri`が指定された場合は既存の自分のBluesky投稿からskyshare entryを発行する
 *   （from-post）。`posts`が指定された場合は新規投稿（1件、またはスレッドとして複数件）を
 *   `com.atproto.repo.applyWrites`で原子的に作成する（全件成功か全件失敗）。
 * - PUT: skyshare entry の manifest.heading/caption を更新する
 *   （主に、紐づく Bluesky 投稿が削除済みの「孤立entry」の編集用途）。
 * - DELETE: skyshare entry を削除する。`deleteBskyPost` 指定時は紐づく Bluesky 投稿も削除する。
 * - 入力不正時は 400、認証不備は 401、対象投稿が見つからない場合は 404、外部連携失敗は 500 を返す。
 *
 * 実装上の制約:
 * - Cloudflare Workers 環境で動作するため、Node.js 固有 API は使用しない。
 * - 画像アップロード・facets 検証・外部 API 呼び出しを含む副作用が複数発生する。
 */

/**
 * `CreatedSkyshareEntry` をレスポンス（`skyshareEntry` フィールド）用の形へ変換する。
 *
 * 処理の趣旨:
 * - クライアントが作成直後にフルリロード無しで削除ボタン等を出し分けられるよう、
 *   AT URI を含む詳細情報を含める。
 *
 * Input:
 * - `entry`: `createBskyThread`/`createEntryFromExistingPost` が返した詳細情報
 *
 * Output:
 * - レスポンス JSON の `posts[i].skyshareEntry` フィールド値
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

const json200 = (body: PostSchema.ResponseBody200Type) =>
    new Response(JSON.stringify(body), {
        status: 200,
        headers: { "Content-Type": "application/json" },
    })

/**
 * POST /v2/entry — Bluesky投稿（1件、またはスレッドとして複数件）を新規作成する、
 * または既存投稿から skyshare entry を発行する（`uri` 指定時、from-post）。
 *
 * 処理フロー:
 * 1. ヘッダ検証（Content-Type, Authorization）
 * 2. 認証済みセッションの取得（`bskySessionRefresh` ミドルウェアが `locals` へ供給）
 * 3. FormData 解析（トップレベルフィールド＋`posts[i][...]`インデックス付きフィールド）
 * 4. OpenAPI スキーマバリデーション（`{uri, ogImage}` または `{posts, reply}`）
 * 4.5. `uri` 指定時は既存投稿からの発行（from-post）に分岐して結果を返却
 * 5. `posts`各要素について: `createEntry`フラグの妥当性検証、画像メタデータ検証、
 *    facets境界検証、embed作成（画像優先、次点でOGP）、画像アップロード、
 *    `createEntry`時はvisualサムネイルアップロード＋表示名解決
 * 6. トップレベル`reply`の所有権検証
 * 7. `createBskyThread`で全投稿＋gate＋skyshare entryを1回の`applyWrites`で原子的に作成
 * 8. 結果返却（`posts`配列。各要素の`skyshareEntry`は作成された場合のみ存在）
 *
 * 入力形状(最小要件):
 * - リクエスト: multipart/form-data
 * - ヘッダ: Content-Type, Authorization
 * - フィールド: `uri` + `ogImage`（既存投稿からの発行）、または
 *   `posts[0][text]`等（新規投稿。1件ならテキストのみ/OGPリンク/画像付きの単発投稿、
 *   複数件ならスレッド）。任意で`reply`（既存スレッドへの接続先）。
 *
 * 出力:
 * - 成功時（200）: `{ posts: [{ url, uri, cid, skyshareEntry? }, ...] }`
 * - 失敗時: 400/401/404/500 と エラーメッセージ
 *
 * 例:
 * - 入力: POST /v2/entry + multipart(posts[0][text]="Hello")
 * - 出力: `{ posts: [{ url: "https://bsky.app/...", uri: "at://...", cid: "bafy..." }] }`
 * - 入力: POST /v2/entry + multipart(uri="at://did:plc:abc/app.bsky.feed.post/3lxyz", ogImage=[...])
 * - 出力: `{ posts: [{ url: "https://bsky.app/...", uri: "at://...", cid: "bafy...", skyshareEntry: {...} }] }`
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
        if (!isMultipartFormData(request.headers.get("content-type"))) {
            return errorResponseFromStatus(400)
        }

        let formData: FormData
        try {
            formData = await request.formData()
        } catch (err) {
            console.warn("createEntry: parseFormData failed", err)
            return errorResponseFromStatus(400)
        }

        const raw = formDataToObject(formData, PostSchema.RequestBodyFieldKinds)
        // multipart/form-dataでは空文字列のtextが送られてくることがあり、
        // OpenAPIのanyOf/min(1)判定を空文字が意図せず壊さないよう、未指定と同義に揃える。
        if (Array.isArray(raw.posts)) {
            for (const item of raw.posts as Record<string, unknown>[]) {
                if (
                    typeof item.text === "string" &&
                    item.text.trim().length === 0
                ) {
                    delete item.text
                }
            }
        }

        // フェーズ 4: OpenAPI スキーマバリデーション
        const body = PostSchema.RequestBodySchema.safeParse(raw)
        if (!body.success) {
            console.error(
                "createEntry: invalid request body: " + JSON.stringify(body),
            )
            return errorResponseFromStatus(400)
        }

        // フェーズ 4.5: uri 指定時は既存投稿からの発行（from-post）に分岐する
        if ("uri" in body.data) {
            const fromPostResult = await createEntryFromExistingPost(
                agent,
                body.data.uri,
                session,
                body.data.ogImage,
            )
            if (!fromPostResult.ok) {
                return errorResponseFromStatus(fromPostResult.status)
            }

            return json200({
                posts: [
                    {
                        url: fromPostResult.bskyUrl,
                        uri: fromPostResult.skyshareEntry.sourceUri,
                        cid: fromPostResult.skyshareEntry.sourceCid,
                        skyshareEntry: serializeSkyshareEntry(
                            fromPostResult.skyshareEntry,
                        ),
                    },
                ],
            })
        }

        // フェーズ 6: トップレベル reply(スレッド接続)の所有権検証
        // root/parentのuriが自分自身のapp.bsky.feed.postを指していない場合、
        // 他人の投稿への不正なreply chain構築とみなし400を返す。
        if (!isReplyRefOwnedBySelf(body.data.reply, session.did)) {
            console.warn("createEntry: reply ref not owned by caller")
            return errorResponseFromStatus(400)
        }

        // フェーズ 5: 各postsについて検証・embed作成・アップロードを行う
        const threadPostInputs: ThreadPostInput[] = []
        for (const item of body.data.posts) {
            const wantsEntry = item.createEntry === true
            const hasImages = !!item.images && item.images.length > 0

            if (wantsEntry && (!hasImages || !item.ogImage)) {
                console.warn(
                    "createEntry: createEntry flag requires images and ogImage",
                )
                return errorResponseFromStatus(400)
            }

            try {
                validateImageMetadata(item.images, item.imagesMeta)
            } catch (err) {
                console.warn(
                    "createEntry: image metadata validation failed",
                    err,
                )
                return errorResponseFromStatus(400)
            }

            const postText = item.text ?? ""
            try {
                validateFacets(postText, item.facets)
            } catch (err) {
                console.warn("createEntry: invalid facets", err)
                return errorResponseFromStatus(400)
            }

            // Embed 作成: 画像（手動添付）と OGP リンクカードは Bluesky 上で同時に
            // 埋め込めないため、画像が指定されている場合はそちらを優先する。
            let embed: any = undefined
            if (hasImages && item.images) {
                let uploadedImages: any[]
                try {
                    uploadedImages = await Promise.all(
                        item.images.map(image => uploadBlob(agent, image)),
                    )
                } catch (err) {
                    console.error("createEntry: image upload failed", err)
                    return errorResponseFromStatus(500)
                }
                embed = createImageEmbed(uploadedImages, item.imagesMeta)
            } else if (item.ogMeta && item.ogImage) {
                let uploadedOgImage: any
                try {
                    uploadedOgImage = await uploadBlob(agent, item.ogImage)
                } catch (err) {
                    console.error("createEntry: ogImage upload failed", err)
                    return errorResponseFromStatus(500)
                }
                try {
                    embed = createExternalEmbed(item.ogMeta, uploadedOgImage)
                } catch (err) {
                    console.error("createEntry: failed to create embed", err)
                    return errorResponseFromStatus(400)
                }
            }

            let entryInput: ThreadPostInput["entry"] | undefined
            if (wantsEntry && item.ogImage) {
                let uploadedVisual: any
                try {
                    uploadedVisual = await uploadBlob(agent, item.ogImage)
                } catch (err) {
                    console.error(
                        "createEntry: visual thumbnail upload failed",
                        err,
                    )
                    return errorResponseFromStatus(500)
                }
                const userName = await resolveDisplayName(
                    agent,
                    session.did,
                    session.handle,
                )
                entryInput = {
                    visual: uploadedVisual,
                    postText,
                    userName,
                }
            }

            threadPostInputs.push({
                text: postText,
                facets: item.facets,
                langs: item.langs,
                embed,
                selfLabel: item.selfLabels,
                gate: item.gate,
                entry: entryInput,
            })
        }

        // フェーズ 7: 投稿＋gate＋skyshare entryを1回のapplyWritesで原子的に作成
        let results
        try {
            results = await createBskyThread(
                agent,
                session.did,
                threadPostInputs,
                body.data.reply,
            )
        } catch (err) {
            console.error("createEntry: applyWrites failed", err)
            return errorResponseFromStatus(500)
        }

        // フェーズ 8: 結果返却
        return json200({
            posts: results.map(result => {
                const rkey = result.uri.split("/").slice(-1)[0]
                return {
                    url: bskyPostUrlgen(session.handle, rkey),
                    uri: result.uri,
                    cid: result.cid,
                    skyshareEntry: result.skyshareEntry
                        ? serializeSkyshareEntry(result.skyshareEntry)
                        : undefined,
                }
            }),
        })
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

        const parsedEntryUri = parseOwnedAtUri(
            body.data.uri,
            ENTRY_COLLECTION,
            session.did,
        )
        if (!parsedEntryUri) {
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

        const parsedEntryUri = parseOwnedAtUri(
            body.data.uri,
            ENTRY_COLLECTION,
            session.did,
        )
        if (!parsedEntryUri) {
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
            const parsedSourceUri = parseOwnedAtUri(
                sourceUri,
                "app.bsky.feed.post",
                session.did,
            )
            if (parsedSourceUri) {
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
