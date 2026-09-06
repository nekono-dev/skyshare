/**
 * POST /v2/bsky/record/ — skyshare entryを伴わないBluesky投稿(テキスト、OGPリンク投稿、
 * または手動の画像投稿)を作成する。
 *
 * 難所: リクエストボディは3択のanyOf(テキストのみ／OGPリンク付き／画像付き)。
 * multipart/form-dataだが、`RequestBodySchema`は素のzod(`z.union`)のみで構成し、
 * バリデーションとOpenAPIドキュメント生成の両方に同一のスキーマを使う(例外を作らない)。
 * FormData→プレーンオブジェクトへのデコードは`RequestBodyFieldKinds`(データのみ、
 * ロジックは`@/util/formData`の`formDataToObject`)を使ってルートハンドラ側で行い、
 * デコード後の値をこのスキーマで検証する。
 */
import { z } from "zod/v4"
import type { ZodOpenApiOperationObject } from "zod-openapi"
import type { FormDataFieldKind } from "@/util/formData"
import * as Common from "../../../common"

const textField = z.string().min(1)
const imageField = z.instanceof(Blob).meta({ type: "string", format: "binary" })
const selfLabelsField = z
    .enum(["sexual", "nudity", "porn", "spoiler", "!warn"])
    .meta({ id: "CreateBskyRecordBodySelfLabels" })

export const RequestBodySchema = z.union([
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
        })
        .strict(),
    // 画像付き投稿(images/imagesMetaが必須)
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
    facets: "json",
    ogImage: "file",
    ogMeta: "json",
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
        url: z.string(),
        uri: z.string(),
        cid: z.string(),
        gateWarning: z.boolean().optional(),
    })
    .strict()
export type ResponseBody200Type = z.infer<typeof ResponseBody200Schema>

export const operation: ZodOpenApiOperationObject = {
    operationId: "createBskyRecord",
    summary:
        "Create a Bluesky post (text, OGP link post, or manual image post) without creating a Skyshare entry",
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
        ...Common.errorResponses(["400", "401", "429", "500"]),
    },
}
