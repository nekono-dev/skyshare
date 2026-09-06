/**
 * DELETE /v1/page/ — legacy pageDB エントリ(と、その元となるOGPアセット)を削除する。
 *
 * バリデーションとOpenAPIドキュメント生成の両方から参照される単一の真実の源。
 */
import { z } from "zod/v4"
import type { ZodOpenApiOperationObject } from "zod-openapi"
import * as Common from "../../common"

export const RequestBodySchema = z
    .object({
        pageId: z.string(),
        did: z.string().optional(),
        accessJwt: z.string(),
    })
    .strict()
export type RequestBodyType = z.infer<typeof RequestBodySchema>

export const ResponseBody200Schema = z.object({ result: z.string() }).strict()
export type ResponseBody200Type = z.infer<typeof ResponseBody200Schema>

export const operation: ZodOpenApiOperationObject = {
    operationId: "deleteLegacyPage",
    summary: "Delete a legacy pageDB entry (and its underlying OGP asset)",
    requestBody: {
        required: true,
        content: { "application/json": { schema: RequestBodySchema } },
    },
    responses: {
        "200": {
            description: "Success",
            content: { "application/json": { schema: ResponseBody200Schema } },
        },
        ...Common.errorResponses(
            ["400", "500"],
            Common.CommonLegacyPageErrorSchema,
        ),
    },
}
