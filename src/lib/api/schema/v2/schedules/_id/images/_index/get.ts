/**
 * GET /v2/schedules/{id}/images/{index}/ — 自分の待機中または失敗の予約に添付した画像を、番号で取得する。
 *
 * バリデーションとOpenAPIドキュメント生成の両方から参照される単一の真実の源。
 * 応答の content-type は保管時の値（image/png など）とする。
 */
import { z } from "zod/v4"
import type { ZodOpenApiOperationObject } from "zod-openapi"
import * as Common from "../../../../../common"

export const PathParamsSchema = z
    .object({
        id: z.string().min(1),
        index: z.coerce.number().int().min(0),
    })
    .strict()
export type PathParamsType = z.infer<typeof PathParamsSchema>

export const operation: ZodOpenApiOperationObject = {
    operationId: "getScheduleImage",
    summary: "Get an image attached to an own pending scheduled post",
    requestParams: { path: PathParamsSchema },
    responses: {
        "200": {
            description: "Success",
            content: {
                "image/*": { schema: { type: "string", format: "binary" } },
            },
        },
        ...Common.errorResponses(["400", "401", "404", "409", "500"]),
    },
}
