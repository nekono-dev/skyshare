/**
 * GET /v2/schedules/limits/ — 予約の制限値（実行時刻の範囲と各上限）を返す。
 *
 * 作成の検証が参照する定数と同じ値を返し、画面はこの値に従う。
 */
import { z } from "zod/v4"
import type { ZodOpenApiOperationObject } from "zod-openapi"
import * as Common from "../../../common"

export const ResponseBody200Schema = z
    .object({
        minLeadSeconds: z.number().int(),
        maxLeadSeconds: z.number().int(),
        maxPending: z.number().int(),
        maxImageBytes: z.number().int(),
        maxPosts: z.number().int(),
    })
    .strict()
export type ResponseBody200Type = z.infer<typeof ResponseBody200Schema>

export const operation: ZodOpenApiOperationObject = {
    operationId: "getScheduleLimits",
    summary: "Get the limits applied to scheduled posts",
    responses: {
        "200": {
            description: "Success",
            content: { "application/json": { schema: ResponseBody200Schema } },
        },
        ...Common.errorResponses(["401", "500"]),
    },
}
