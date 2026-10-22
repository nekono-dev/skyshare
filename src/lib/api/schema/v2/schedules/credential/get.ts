/**
 * GET /v2/schedules/credential/ — 予約用の認証情報の登録状態を返す。
 */
import { z } from "zod/v4"
import type { ZodOpenApiOperationObject } from "zod-openapi"
import * as Common from "../../../common"

export const ResponseBody200Schema = z
    .object({ registered: z.boolean(), updatedAt: z.string().optional() })
    .strict()
export type ResponseBody200Type = z.infer<typeof ResponseBody200Schema>

export const operation: ZodOpenApiOperationObject = {
    operationId: "getScheduleCredential",
    summary: "Get whether a credential for scheduled posts is registered",
    responses: {
        "200": {
            description: "Success",
            content: { "application/json": { schema: ResponseBody200Schema } },
        },
        ...Common.errorResponses(["401", "500"]),
    },
}
