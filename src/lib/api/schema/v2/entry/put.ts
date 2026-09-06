/**
 * PUT /v2/entry/ — 既存のskyshare entry(dev.nekono.skyshare.entry)のheading/captionを更新する。
 *
 * バリデーションとOpenAPIドキュメント生成の両方から参照される単一の真実の源。
 */
import { z } from "zod/v4"
import type { ZodOpenApiOperationObject } from "zod-openapi"
import * as Common from "../../common"

export const RequestBodySchema = z
    .object({
        uri: z.string(),
        heading: z.string().max(100),
        caption: z.string().max(300),
    })
    .strict()
export type RequestBodyType = z.infer<typeof RequestBodySchema>

export const RequestHeaderSchema = z.object({
    cookie: Common.CommonCookieSchema,
})
export type RequestHeaderType = z.infer<typeof RequestHeaderSchema>

export const operation: ZodOpenApiOperationObject = {
    operationId: "updateEntry",
    summary:
        "Update the heading/caption of an existing Skyshare entry (dev.nekono.skyshare.entry)",
    requestParams: { header: RequestHeaderSchema },
    requestBody: {
        required: true,
        content: { "application/json": { schema: RequestBodySchema } },
    },
    responses: {
        "200": { description: "Success" },
        ...Common.errorResponses(["400", "401", "404", "429", "500"]),
    },
}
