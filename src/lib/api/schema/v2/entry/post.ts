/**
 * POST /v2/entry/ — 画像投稿+skyshare entryを新規作成する、または既存投稿から
 * skyshare entryを発行する(`uri`指定時、from-post)。
 *
 * 難所: リクエストボディは2択のanyOf(既存投稿から発行／新規画像投稿)。
 * multipart/form-dataだが、`RequestBodySchema`は素のzod(`z.union`)のみで構成し、
 * バリデーションとOpenAPIドキュメント生成の両方に同一のスキーマを使う(例外を作らない)。
 * FormData→プレーンオブジェクトへのデコードは`RequestBodyFieldKinds`(データのみ、
 * ロジックは`@/util/formData`の`formDataToObject`)を使ってルートハンドラ側で行い、
 * デコード後の値をこのスキーマで検証する(JSON bodyの
 * `request.json()`→`Schema.safeParse(json)`と同じ形に揃えている)。
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

export const RequestBodySchema = z.union([
    // 既存投稿からskyshare entryを発行(from-post): uri + ogImage が必須
    z
        .object({
            text: textField.optional(),
            ogImage: imageField,
            uri: z.string(),
            images: z.array(imageField).optional(),
            imagesMeta: Common.CommonImagesMetaSchema.optional(),
            langs: z.array(z.string()).optional(),
            selfLabels: selfLabelsField.optional(),
            gate: Common.CommonGateSettingsSchema.optional(),
        })
        .strict(),
    // 新規画像投稿: images + imagesMeta + ogImage が必須
    z
        .object({
            text: textField.optional(),
            ogImage: imageField,
            uri: z.string().optional(),
            images: z.array(imageField),
            imagesMeta: Common.CommonImagesMetaSchema,
            langs: z.array(z.string()).optional(),
            selfLabels: selfLabelsField.optional(),
            gate: Common.CommonGateSettingsSchema.optional(),
        })
        .strict(),
])
export type RequestBodyType = z.infer<typeof RequestBodySchema>

/**
 * FormDataの各フィールドをどう解釈してデコードするか(ドメイン知識)。
 * `formDataToObject`(汎用・ドメイン非依存)と組み合わせてルートハンドラ側で使う。
 */
export const RequestBodyFieldKinds: Record<string, FormDataFieldKind> = {
    text: "text",
    ogImage: "file",
    uri: "text",
    images: "files",
    imagesMeta: "json",
    langs: "texts",
    selfLabels: "text",
    gate: "json",
}

export const RequestHeaderSchema = z.object({
    cookie: Common.CommonCookieSchema,
})
export type RequestHeaderType = z.infer<typeof RequestHeaderSchema>

export const ResponseBody200Schema = z
    .object({
        bsky: z
            .object({
                url: z.string(),
                gateWarning: z.boolean().optional(),
            })
            .strict(),
        skyshare: z
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
            .strict(),
    })
    .strict()
export type ResponseBody200Type = z.infer<typeof ResponseBody200Schema>

export const operation: ZodOpenApiOperationObject = {
    operationId: "createEntry",
    summary:
        "Create a new image post together with a Skyshare entry, or attach an entry to an existing Bluesky post when `uri` is given",
    requestParams: { header: RequestHeaderSchema },
    requestBody: {
        required: true,
        content: { "multipart/form-data": { schema: RequestBodySchema } },
    },
    responses: {
        "200": {
            description: "Success post",
            content: { "application/json": { schema: ResponseBody200Schema } },
        },
        ...Common.errorResponses(["400", "401", "404", "429", "500"]),
    },
}
