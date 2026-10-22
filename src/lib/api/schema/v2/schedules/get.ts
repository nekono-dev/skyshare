/**
 * GET /v2/schedules/ — 自分の予約を、実行時刻の昇順で一覧する。
 *
 * バリデーションとOpenAPIドキュメント生成の両方から参照される単一の真実の源。
 */
import { z } from "zod/v4"
import type { ZodOpenApiOperationObject } from "zod-openapi"
import * as Common from "../../common"

export const QuerySchema = z
    .object({
        status: z.enum(["pending", "running", "failed"]).optional(),
        limit: z.coerce.number().int().min(1).max(50).default(20),
        cursor: z.string().min(1).optional(),
    })
    .strict()
export type QueryType = z.infer<typeof QuerySchema>

export const ScheduleListItemSchema = z
    .object({
        id: z.string(),
        runAt: z.string(),
        status: z.enum(["pending", "running", "failed"]),
        postCount: z.number().int(),
        preview: z.string(),
        lastError: z.string().nullable(),
    })
    .strict()
export type ScheduleListItemType = z.infer<typeof ScheduleListItemSchema>

export const ResponseBody200Schema = z
    .object({
        items: z.array(ScheduleListItemSchema),
        cursor: z.string().optional(),
    })
    .strict()
export type ResponseBody200Type = z.infer<typeof ResponseBody200Schema>

export const operation: ZodOpenApiOperationObject = {
    operationId: "listSchedules",
    summary: "List own scheduled posts ordered by run time",
    requestParams: { query: QuerySchema },
    responses: {
        "200": {
            description: "Success",
            content: { "application/json": { schema: ResponseBody200Schema } },
        },
        ...Common.errorResponses(["400", "401", "500"]),
    },
}
