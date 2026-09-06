/**
 * GET /v1/extract/ — 指定URLからOGP情報を抽出する。
 *
 * バリデーションとOpenAPIドキュメント生成の両方から参照される単一の真実の源。
 */
import { z } from "zod/v4"
import type { ZodOpenApiOperationObject } from "zod-openapi"
import * as Common from "../../common"

export const QueryParamsSchema = z.object({ url: z.string() }).strict()
export type QueryParamsType = z.infer<typeof QueryParamsSchema>

export const ResponseBody200Schema = Common.CommonOgMetaSchema
export type ResponseBody200Type = Common.CommonOgMetaType

export const operation: ZodOpenApiOperationObject = {
    operationId: "extractUrl",
    summary: "Extract OGP information from URL",
    requestParams: { query: QueryParamsSchema },
    responses: {
        "200": {
            description: "Success",
            content: { "application/json": { schema: ResponseBody200Schema } },
        },
        ...Common.errorResponses(["400"]),
    },
}
