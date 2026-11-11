/** 投稿または投稿スレッドを作成し、任意で Skyshare entry を関連付ける API の入力スキーマ。 */
import { z } from "zod/v4"
import type { ZodOpenApiOperationObject } from "zod-openapi"
import type { FormDataFieldKind } from "@/types/formData"
import { MAX_THREAD_POST_COUNT } from "@/lib/atproto/threadLimit"
import { MAX_POST_IMAGES } from "@/lib/image/postImageLimits"
import { countUtf8Bytes } from "@/util/utf8Bytes"
import * as Common from "../../common"

const textField = z.string().min(1)
// AT Protocol の manifest に合わせた見出しとキャプション。
const headingField = z
    .string()
    .max(100)
    .refine(v => countUtf8Bytes(v) <= 100)
const captionField = z
    .string()
    .max(300)
    .refine(v => countUtf8Bytes(v) <= 300)
const imageField = z.instanceof(Blob).meta({ type: "string", format: "binary" })
const selfLabelsField = z
    .enum(["sexual", "nudity", "porn", "spoiler", "!warn"])
    .meta({ id: "CreateEntryBodySelfLabels" })

/** 投稿またはスレッドの各投稿の入力スキーマ。 */
export const EntryPostItemSchema = z.union([
    // テキストのみの投稿
    z
        .object({
            text: textField,
            facets: Common.CommonFacetsSchema.optional(),
            ogImage: imageField.optional(),
            ogMeta: Common.CommonOgMetaSchema.optional(),
            images: z.array(imageField).max(MAX_POST_IMAGES).optional(),
            imagesMeta: Common.CommonImagesMetaSchema.optional(),
            langs: z.array(z.string()).optional(),
            selfLabels: selfLabelsField.optional(),
            gate: Common.CommonGateSettingsSchema.optional(),
        })
        .strict(),
    // OGPリンク付き投稿(ogImage/ogMetaが必須)
    z
        .object({
            text: textField.optional(),
            facets: Common.CommonFacetsSchema.optional(),
            ogImage: imageField,
            ogMeta: Common.CommonOgMetaSchema,
            images: z.array(imageField).max(MAX_POST_IMAGES).optional(),
            imagesMeta: Common.CommonImagesMetaSchema.optional(),
            langs: z.array(z.string()).optional(),
            selfLabels: selfLabelsField.optional(),
            gate: Common.CommonGateSettingsSchema.optional(),
        })
        .strict(),
    // 画像付き投稿(images/imagesMetaが必須)
    z
        .object({
            text: textField.optional(),
            facets: Common.CommonFacetsSchema.optional(),
            ogImage: imageField.optional(),
            ogMeta: Common.CommonOgMetaSchema.optional(),
            images: z.array(imageField).max(MAX_POST_IMAGES),
            imagesMeta: Common.CommonImagesMetaSchema,
            langs: z.array(z.string()).optional(),
            selfLabels: selfLabelsField.optional(),
            gate: Common.CommonGateSettingsSchema.optional(),
        })
        .strict(),
    // 動画付き投稿(video/videoMetaが必須。画像・OGPリンクとは排他。
    // 上の3分岐は`.strict()`で`video`を持てず、本分岐は`images`/`ogImage`/`ogMeta`を
    // 持たないため、排他が構造的に保たれる)
    z
        .object({
            text: textField.optional(),
            facets: Common.CommonFacetsSchema.optional(),
            video: Common.CommonVideoBlobSchema,
            videoMeta: Common.CommonVideoMetaSchema,
            langs: z.array(z.string()).optional(),
            selfLabels: selfLabelsField.optional(),
            gate: Common.CommonGateSettingsSchema.optional(),
        })
        .strict(),
])
export type EntryPostItemType = z.infer<typeof EntryPostItemSchema>

export const RequestBodySchema = z.union([
    // 既存投稿からskyshare entryを発行(from-post、新規投稿は作らない)
    z
        .object({
            uri: z.string(),
            visual: imageField,
            heading: headingField.optional(),
            caption: captionField.optional(),
        })
        .strict(),
    // `createEntry` と `visual` は投稿単位ではなくリクエスト全体に指定する。
    z
        .object({
            posts: z
                .array(EntryPostItemSchema)
                .min(1)
                .max(MAX_THREAD_POST_COUNT),
            reply: Common.CommonReplyRefSchema.optional(),
            createEntry: z.boolean().optional(),
            visual: imageField.optional(),
            heading: headingField.optional(),
            caption: captionField.optional(),
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
    video: "json",
    videoMeta: "json",
    langs: "texts",
    selfLabels: "text",
    gate: "json",
}

/**
 * リクエストボディ全体のFormData種別マップ。`uri`/`visual`/`reply`/`createEntry`は
 * トップレベルの単一フィールド、`posts`は`{kind:"items"}`種別として宣言し、
 * `posts[i][...]`というインデックス付きフィールドから複数件（スレッド）を復元する。
 * この宣言が、クライアント側（`src/lib/codegen/openapiFormData.ts`の
 * `ITEMS_FIELD_NAMES`）が`posts`を常にインデックス展開する根拠と対になっている。
 */
export const RequestBodyFieldKinds: Record<string, FormDataFieldKind> = {
    uri: "text",
    visual: "file",
    heading: "json",
    caption: "json",
    reply: "json",
    createEntry: "json",
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
                    })
                    .strict(),
            )
            .min(1),
        skyshareEntry: SkyshareEntrySchema.optional(),
    })
    .strict()
export type ResponseBody200Type = z.infer<typeof ResponseBody200Schema>

export const operation: ZodOpenApiOperationObject = {
    operationId: "createEntry",
    summary:
        "Create Bluesky posts, optionally as a thread and with a Skyshare entry, or attach an entry to an existing post",
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
