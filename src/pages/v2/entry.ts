/**
 * Skyshare v2 entry API。Bluesky 投稿（テキスト・OGP リンク・画像・動画。1 件またはスレッド）の作成と、紐づく skyshare entry の作成・更新・削除を扱う統合エンドポイント。
 *
 * - POST は `uri` 指定なら自分の既存の投稿から entry を発行し（from-post）、`posts` 指定なら新規投稿を `com.atproto.repo.applyWrites` で原子的に作成する（全件成功か全件失敗）。
 * - PUT は entry の manifest.heading/caption を更新する（主に、紐づく投稿が削除済みの「孤立 entry」の編集用）。DELETE は `deleteBskyPost` 指定時に紐づく投稿も削除する。
 * - 画像アップロード・facets 検証・外部 API 呼び出しの副作用が複数あり、Cloudflare Workers 環境で動くため Node.js 固有 API は使わない。
 */
import type { APIRoute } from "astro"

import { resolveXrpcStatus } from "@/lib/api/response"
import { errorResponseFromStatus, jsonResponse } from "@/util/http"
import { convertHeaderToObj, isMultipartFormData } from "@/util/http"
import { formDataToObject } from "@/util/formData"
import { ENTRY_COLLECTION } from "@/lib/atproto/nsid"
import { postEntry } from "@/lib/entry/postEntry"
import { deleteEntry } from "@/lib/entry/deleteEntry"
import { editEntry } from "@/lib/entry/editEntry"

import * as PostSchema from "@/lib/api/schema/v2/entry/post"
import * as PutSchema from "@/lib/api/schema/v2/entry/put"
import * as DeleteSchema from "@/lib/api/schema/v2/entry/delete"
import { parseOwnedAtUri } from "@/lib/atproto/atUri"

/**
 * POST /v2/entry — Bluesky投稿（1件、またはスレッドとして複数件）を新規作成する、
 * または既存投稿から skyshare entry を発行する（`uri` 指定時、from-post）。
 *
 * 処理フロー:
 * 1. ヘッダ検証（Content-Type, Authorization）
 * 2. 認証済みセッションの取得（`bskySessionRefresh` ミドルウェアが `locals` へ供給）
 * 3. FormData 解析（トップレベルフィールド＋`posts[i][...]`インデックス付きフィールド）
 * 4. OpenAPI スキーマバリデーション（`{uri, visual}` または `{posts, reply, createEntry?, visual?}`）
 * 4.5 以降（from-post・返信の所有・作成・応答）の判断は `lib/entry/postEntry.ts` の `postEntry` が行い、
 *     ページは結果を応答へ変換する。以下は `postEntry` 内の処理の流れ。
 * 4.5. `uri` 指定時は既存投稿からの発行（from-post）に分岐して結果を返却
 * 5a. トップレベル`createEntry:true`の妥当性検証（`visual`必須。画像投稿の有無は検証しない）
 * 5b. `posts`各要素について: 画像メタデータ検証、facets境界検証、
 *     embed作成（動画、画像、OGPの順に優先）、画像アップロード
 * 5c. `createEntry:true`ならvisualを1回だけアップロード
 * 6. トップレベル`reply`の所有権検証
 * 7. `createBskyThread`で全投稿＋gate＋（高々1件の）skyshare entryを
 *    1回の`applyWrites`で原子的に作成（`source`は常にposts[0]）
 * 8. 結果返却（`posts`配列＋トップレベル`skyshareEntry`）
 *
 * 入力形状(最小要件):
 * - リクエスト: multipart/form-data
 * - ヘッダ: Content-Type, Authorization
 * - フィールド: `uri` + `visual`（既存投稿からの発行）、または
 *   `posts[0][text]`等（新規投稿。1件ならテキストのみ/OGPリンク/画像/動画付きの単発投稿、
 *   複数件ならスレッド）。任意で`reply`（既存スレッドへの接続先）、
 *   任意でトップレベル`createEntry`+`visual`（entry作成、リクエスト全体で高々1組）。
 *
 * 出力:
 * - 成功時（200）: `{ posts: [{ url, uri, cid }, ...], skyshareEntry? }`
 * - 失敗時: 400/401/404/500 と エラーメッセージ
 *
 * 例:
 * - 入力: POST /v2/entry + multipart(posts[0][text]="Hello")
 * - 出力: `{ posts: [{ url: "https://bsky.app/...", uri: "at://...", cid: "bafy..." }] }`
 * - 入力: POST /v2/entry + multipart(uri="at://did:plc:abc/app.bsky.feed.post/3lxyz", visual=[...])
 * - 出力: `{ posts: [{ url: "https://bsky.app/...", uri: "at://...", cid: "bafy..." }], skyshareEntry: {...} }`
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

        // フェーズ 5: 作成の判断（from-post の分岐・reply の所有・埋め込み・作成・応答の組み立て）は lib に委ねる
        const result = await postEntry({
            agent,
            session,
            request: body.data,
        })
        if (!result.ok) {
            return errorResponseFromStatus(result.status)
        }

        // 応答の形が api の推論型に代入できることを、型注釈付きの代入で確かめる
        const res: PostSchema.ResponseBody200Type = result.value
        return jsonResponse(res)
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

        const outcome = await editEntry({
            agent,
            session,
            request: {
                entryRkey: parsedEntryUri.rkey,
                heading: body.data.heading,
                caption: body.data.caption,
            },
        })
        if (!outcome.ok) {
            return errorResponseFromStatus(outcome.status)
        }

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
 * 4. `deleteBskyPost` が true かつ source が自分自身の app.bsky.feed.post の場合、
 *    entry 削除より前に削除対象を導出する（`resolveDeleteTargets`）。source が返信投稿
 *    （スレッドの起点でない）なら 409、導出失敗なら 500 で、何も削除せず終了する。
 * 5. skyshare entry レコードを削除する。
 * 6. 導出した投稿（source 起点の自己後続投稿すべて。単発なら1件）を削除する
 *    （1件なら deleteRecord、2件以上なら1回の applyWrites）。失敗しても entry 削除
 *    自体は成功として扱う。
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

        // URI の所有検証（自分自身の dev.nekono.skyshare.entry であること）。
        const parsedEntryUri = parseOwnedAtUri(
            body.data.uri,
            ENTRY_COLLECTION,
            session.did,
        )
        if (!parsedEntryUri) {
            return errorResponseFromStatus(400)
        }

        const outcome = await deleteEntry({
            agent,
            session,
            request: {
                entryRkey: parsedEntryUri.rkey,
                deleteBskyPost: body.data.deleteBskyPost,
            },
        })
        if (!outcome.ok) {
            return errorResponseFromStatus(outcome.status)
        }

        return new Response(undefined, { status: 200 })
    } catch (error) {
        console.error("deleteEntry: delete entry error", error)
        return errorResponseFromStatus(resolveXrpcStatus(error))
    }
}
