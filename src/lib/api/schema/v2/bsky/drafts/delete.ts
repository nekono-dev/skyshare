/**
 * DELETE /v2/bsky/drafts/ — Blueskyの下書きを削除する。
 *
 * バリデーションとOpenAPIドキュメント生成の両方から参照される単一の真実の源。
 */
import { z } from "zod/v4"
import type { ZodOpenApiOperationObject } from "zod-openapi"
import * as Common from "../../../common"

export const RequestBodySchema = z.object({ id: z.string() }).strict()
export type RequestBodyType = z.infer<typeof RequestBodySchema>

export const RequestHeaderSchema = z.object({
    cookie: Common.CommonCookieSchema,
})
export type RequestHeaderType = z.infer<typeof RequestHeaderSchema>

export const operation: ZodOpenApiOperationObject = {
    operationId: "deleteDraft",
    summary: "Delete a Bluesky draft",
    requestParams: { header: RequestHeaderSchema },
    requestBody: {
        required: true,
        content: { "application/json": { schema: RequestBodySchema } },
    },
    responses: {
        "200": { description: "Success" },
        ...Common.errorResponses(["400", "401", "429", "500"]),
    },
}
