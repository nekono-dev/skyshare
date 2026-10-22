/**
 * DELETE /v2/schedules/credential/ — 予約用の認証情報を削除し、予約投稿を無効にする。
 *
 * 待機中の予約はすべて取り消し、取り消した件数を返す。実行中の予約があるときは、何もせず 409 を返す。
 */
import { z } from "zod/v4"
import type { ZodOpenApiOperationObject } from "zod-openapi"
import * as Common from "../../../common"

export const ResponseBody200Schema = z
    .object({ registered: z.literal(false), cancelled: z.number().int() })
    .strict()
export type ResponseBody200Type = z.infer<typeof ResponseBody200Schema>

export const operation: ZodOpenApiOperationObject = {
    operationId: "deleteScheduleCredential",
    summary: "Delete the credential for scheduled posts",
    responses: {
        "200": {
            description: "Success",
            content: { "application/json": { schema: ResponseBody200Schema } },
        },
        ...Common.errorResponses(["401", "409", "500"]),
    },
}
