/**
 * GET /v1/page/{dbIndex}/{dbKey}/ — legacy pageDB エントリ(OGP画像・投稿者handle・添付画像)を取得する。
 *
 * バリデーションとOpenAPIドキュメント生成の両方から参照される単一の真実の源。
 */
import { z } from "zod/v4"
import type { ZodOpenApiOperationObject } from "zod-openapi"
import * as Common from "../../../../common"

export const PathParamsSchema = z
    .object({ dbIndex: z.string(), dbKey: z.string() })
    .strict()
export type PathParamsType = z.infer<typeof PathParamsSchema>

export const ResponseBody200Schema = Common.CommonLegacyPageEntrySchema
export type ResponseBody200Type = Common.CommonLegacyPageEntryType

export const operation: ZodOpenApiOperationObject = {
    operationId: "getLegacyPage",
    summary:
        "Get a legacy pageDB entry (OGP image / poster handle / attached images)",
    requestParams: { path: PathParamsSchema },
    responses: {
        "200": {
            description: "Success",
            content: { "application/json": { schema: ResponseBody200Schema } },
        },
        ...Common.errorResponses(
            ["400", "500", "503"],
            Common.CommonLegacyPageErrorSchema,
        ),
    },
}
