/**
 * DELETE /v2/entry/ — skyshare entryを削除する。
 * オプションで、紐づくBluesky投稿も削除する。
 */
import { z } from "zod/v4"
import type { ZodOpenApiOperationObject } from "zod-openapi"
import * as Common from "../../common"

/** `deleteBskyPost` は `source` と、そこから続く自分の返信投稿を削除する。 */
export const RequestBodySchema = z
    .object({
        uri: z.string(),
        deleteBskyPost: z.boolean().optional(),
    })
    .strict()
export type RequestBodyType = z.infer<typeof RequestBodySchema>

export const RequestHeaderSchema = z.object({
    cookie: Common.CommonCookieSchema,
})
export type RequestHeaderType = z.infer<typeof RequestHeaderSchema>

export const operation: ZodOpenApiOperationObject = {
    operationId: "deleteEntry",
    summary:
        "Delete a Skyshare entry and optionally its source Bluesky post thread",
    requestParams: { header: RequestHeaderSchema },
    requestBody: {
        required: true,
        content: { "application/json": { schema: RequestBodySchema } },
    },
    responses: {
        "200": { description: "Success" },
        ...Common.errorResponses(["400", "401", "404", "409", "429", "500"]),
    },
}
