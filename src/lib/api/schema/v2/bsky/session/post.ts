/**
 * POST /v2/bsky/session/ — ATProtoサービスへログインする。
 *
 * バリデーションとOpenAPIドキュメント生成の両方から参照される単一の真実の源。
 */
import { z } from "zod/v4"
import type { ZodOpenApiOperationObject } from "zod-openapi"
import * as Common from "../../../common"

export const RequestBodySchema = z
    .object({
        identifier: z.string(),
        password: z.string(),
        service: z.string(),
    })
    .strict()
export type RequestBodyType = z.infer<typeof RequestBodySchema>

export const ResponseHeaders200Schema = z.object({
    "set-cookie": Common.CommonCookieSchema.optional(),
})
export type ResponseHeaders200Type = z.infer<typeof ResponseHeaders200Schema>

export const operation: ZodOpenApiOperationObject = {
    operationId: "createSession",
    summary: "Login ATProto service",
    requestBody: {
        required: true,
        content: { "application/json": { schema: RequestBodySchema } },
    },
    responses: {
        "200": {
            description: "Success",
            headers: ResponseHeaders200Schema,
        },
        ...Common.errorResponses(["400", "401", "429", "500"]),
    },
}
