/**
 * PUT /v2/bsky/session/ — アクティブセッションを、プールされたアカウントのセッションで上書きする(アカウント切り替え)。
 *
 * バリデーションとOpenAPIドキュメント生成の両方から参照される単一の真実の源。
 */
import { z } from "zod/v4"
import type { ZodOpenApiOperationObject } from "zod-openapi"
import * as Common from "../../../common"

export const RequestBodySchema = z.object({ did: z.string() }).strict()
export type RequestBodyType = z.infer<typeof RequestBodySchema>

export const ResponseHeaders200Schema = z.object({
    "set-cookie": Common.CommonCookieSchema.optional(),
})
export type ResponseHeaders200Type = z.infer<typeof ResponseHeaders200Schema>

export const operation: ZodOpenApiOperationObject = {
    operationId: "updateSession",
    summary:
        "Overwrite the active session with a pooled account's session (account switch)",
    requestBody: {
        required: true,
        content: { "application/json": { schema: RequestBodySchema } },
    },
    responses: {
        "200": {
            description: "Success",
            headers: ResponseHeaders200Schema,
        },
        ...Common.errorResponses(["400", "401", "404", "500"]),
    },
}
