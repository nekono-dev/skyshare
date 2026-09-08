/**
 * POST /v2/entry/ — Bluesky投稿(1件、またはスレッドとして複数件)を作成する統合エンドポイント。
 * `/v2/bsky/record`は廃止され、本エンドポイントに統合された。
 *
 * リクエストボディは2択のanyOf:
 * - 既存投稿からskyshare entryを発行する(from-post、新規投稿は作らない、スレッド概念なし)
 * - 新規投稿(`posts`配列。1件ならテキストのみ/OGPリンク/画像付きの単発投稿、
 *   複数件ならBlueskyのスレッド(reply chain)として原子的に作成する)
 *
 * 各`posts[i]`は`createEntry`フラグにより、その投稿に紐づくskyshare entryを
 * 作成するかどうかをクライアントが指定できる(画像投稿でなければtrueは無効)。
 *
 * `reply`(スレッド接続用のStrongRef)は`posts`と同階層のトップレベルフィールドとして
 * 1つだけ持つ。同一リクエスト内の2件目以降のreply chainはサーバが自動的に組み立てるため、
 * クライアントが指定する必要があるのは「このリクエスト全体(posts[0])が既存のどの投稿に
 * 接続するか」だけであり、配列の要素ごとに持たせる意味が無いため。
 *
 * multipart/form-dataだが、`RequestBodySchema`は素のzodのみで構成し、バリデーションと
 * OpenAPIドキュメント生成の両方に同一のスキーマを使う(例外を作らない)。FormData→
 * プレーンオブジェクトへのデコードは、`RequestBodyFieldKinds`+`formDataToObject`
 * (`@/util/formData`)をルートハンドラ側で1回呼ぶだけで行う。`posts`は`{kind:"items"}`
 * 種別として宣言されており、`posts[i][...]`というインデックス付きフィールドから
 * 複数件のプレーンオブジェクト配列へ自動的に復元される。
 */
import { z } from "zod/v4"
import type { ZodOpenApiOperationObject } from "zod-openapi"
import type { FormDataFieldKind } from "@/util/formData"
import * as Common from "../../common"

const textField = z.string().min(1)
const imageField = z.instanceof(Blob).meta({ type: "string", format: "binary" })
const selfLabelsField = z
    .enum(["sexual", "nudity", "porn", "spoiler", "!warn"])
    .meta({ id: "CreateEntryBodySelfLabels" })

/**
 * `posts`配列の1件分(1セグメント)。現行`/v2/bsky/record`の3分岐
 * (テキストのみ/OGPリンク付き/画像付き)をそのまま引き継ぎ、`createEntry`フラグを追加する。
 */
export const EntryPostItemSchema = z.union([
    // テキストのみの投稿
    z
        .object({
            text: textField,
            facets: Common.CommonFacetsSchema.optional(),
            ogImage: imageField.optional(),
            ogMeta: Common.CommonOgMetaSchema.optional(),
            images: z.array(imageField).optional(),
            imagesMeta: Common.CommonImagesMetaSchema.optional(),
            langs: z.array(z.string()).optional(),
            selfLabels: selfLabelsField.optional(),
            gate: Common.CommonGateSettingsSchema.optional(),
            createEntry: z.boolean().optional(),
        })
        .strict(),
    // OGPリンク付き投稿(ogImage/ogMetaが必須)
    z
        .object({
            text: textField.optional(),
            facets: Common.CommonFacetsSchema.optional(),
            ogImage: imageField,
            ogMeta: Common.CommonOgMetaSchema,
            images: z.array(imageField).optional(),
            imagesMeta: Common.CommonImagesMetaSchema.optional(),
            langs: z.array(z.string()).optional(),
            selfLabels: selfLabelsField.optional(),
            gate: Common.CommonGateSettingsSchema.optional(),
            createEntry: z.boolean().optional(),
        })
        .strict(),
    // 画像付き投稿(images/imagesMetaが必須。createEntry:trueにはogImageも必須。
    // ただし異なるunion分岐をまたぐ条件のためZodでは表現せず、ハンドラ側で検証する)
    z
        .object({
            text: textField.optional(),
            facets: Common.CommonFacetsSchema.optional(),
            ogImage: imageField.optional(),
            ogMeta: Common.CommonOgMetaSchema.optional(),
            images: z.array(imageField),
            imagesMeta: Common.CommonImagesMetaSchema,
            langs: z.array(z.string()).optional(),
            selfLabels: selfLabelsField.optional(),
            gate: Common.CommonGateSettingsSchema.optional(),
            createEntry: z.boolean().optional(),
        })
        .strict(),
])
export type EntryPostItemType = z.infer<typeof EntryPostItemSchema>

export const RequestBodySchema = z.union([
    // 既存投稿からskyshare entryを発行(from-post、新規投稿は作らない)
    z
        .object({
            uri: z.string(),
            ogImage: imageField,
        })
        .strict(),
    // 新規投稿(1件、またはスレッドとして複数件)
    z
        .object({
            posts: z.array(EntryPostItemSchema).min(1).max(100),
            reply: Common.CommonReplyRefSchema.optional(),
        })
        .strict(),
])
export type RequestBodyType = z.infer<typeof RequestBodySchema>

/**
 * `posts[i][...]`という1セグメント分のFormData種別マップ。
 * `text`が`"text"`(生文字列)ではなく`"json"`である理由は、multipart/form-dataの
 * text種別フィールドは`\n`が`\r\n`へブラウザ側で正規化されてしまい、クライアントが
 * `\n`前提で計算したfacetsのバイトオフセットとズレて投稿が破綻するため
 * (`src/lib/codegen/openapiFormData.ts`のJSON化と対で、生の改行を含む文字列を
 * multipartのテキストパートに直接乗せない)。
 */
export const PostItemFieldKinds: Record<string, FormDataFieldKind> = {
    text: "json",
    facets: "json",
    ogImage: "file",
    ogMeta: "json",
    images: "files",
    imagesMeta: "json",
    langs: "texts",
    selfLabels: "text",
    gate: "json",
    createEntry: "json",
}

/**
 * リクエストボディ全体のFormData種別マップ。`uri`/`ogImage`/`reply`はトップレベルの
 * 単一フィールド、`posts`は`{kind:"items"}`種別として宣言し、`posts[i][...]`という
 * インデックス付きフィールドから複数件（スレッド）を復元する。この宣言が、クライアント側
 * （`src/lib/codegen/openapiFormData.ts`の`ITEMS_FIELD_NAMES`）が`posts`を常に
 * インデックス展開する根拠と対になっている。
 */
export const RequestBodyFieldKinds: Record<string, FormDataFieldKind> = {
    uri: "text",
    ogImage: "file",
    reply: "json",
    posts: { kind: "items", itemFieldKinds: PostItemFieldKinds },
}

export const RequestHeaderSchema = z.object({
    cookie: Common.CommonCookieSchema,
})
export type RequestHeaderType = z.infer<typeof RequestHeaderSchema>

/**
 * 作成されたskyshare entryのレスポンス表現。`createEntry`が指定されなかった、
 * または対象投稿が画像投稿でなかった場合は各`posts[i]`でこのフィールド自体が無い(undefined)。
 */
export const SkyshareEntrySchema = z
    .object({
        uri: z.string(),
        atUri: z.string(),
        cid: z.string(),
        createdAt: z.string(),
        sourceUri: z.string(),
        sourceCid: z.string(),
        heading: z.string().optional(),
        caption: z.string().optional(),
        visualUrl: z.string().optional(),
    })
    .strict()
export type SkyshareEntryType = z.infer<typeof SkyshareEntrySchema>

export const ResponseBody200Schema = z
    .object({
        posts: z
            .array(
                z
                    .object({
                        url: z.string(),
                        uri: z.string(),
                        cid: z.string(),
                        skyshareEntry: SkyshareEntrySchema.optional(),
                    })
                    .strict(),
            )
            .min(1),
    })
    .strict()
export type ResponseBody200Type = z.infer<typeof ResponseBody200Schema>

export const operation: ZodOpenApiOperationObject = {
    operationId: "createEntry",
    summary:
        "Create one or more Bluesky posts (optionally as a thread), each optionally paired with a Skyshare entry, or attach an entry to an existing Bluesky post when `uri` is given",
    requestParams: { header: RequestHeaderSchema },
    requestBody: {
        required: true,
        content: { "multipart/form-data": { schema: RequestBodySchema } },
    },
    responses: {
        "200": {
            description: "Success",
            content: { "application/json": { schema: ResponseBody200Schema } },
        },
        ...Common.errorResponses(["400", "401", "404", "429", "500"]),
    },
}
