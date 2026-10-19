/**
 * DELETE /v2/schedules/{id}/ — 待機中の予約を取り消す、または投稿済み・失敗の予約の履歴を削除する。
 *
 * バリデーションとOpenAPIドキュメント生成の両方から参照される単一の真実の源。
 */
import { z } from "zod/v4"
import type { ZodOpenApiOperationObject } from "zod-openapi"
import * as Common from "../../../common"

export const PathParamsSchema = z.object({ id: z.string().min(1) }).strict()
export type PathParamsType = z.infer<typeof PathParamsSchema>

export const operation: ZodOpenApiOperationObject = {
    operationId: "deleteSchedule",
    summary:
        "Cancel a pending scheduled post, or delete the history of a posted or failed one",
    requestParams: { path: PathParamsSchema },
    responses: {
        "200": { description: "Success" },
        ...Common.errorResponses(["401", "404", "409", "500"]),
    },
}
