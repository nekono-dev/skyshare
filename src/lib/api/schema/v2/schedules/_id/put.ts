/**
 * PUT /v2/schedules/{id}/ — 自分の待機中の予約を、実行時刻・内容・画像ごと置き換える。
 *
 * バリデーションとOpenAPIドキュメント生成の両方から参照される単一の真実の源。
 * 入力は予約の作成（POST /v2/schedules/）と同じスキーマを使う。
 */
import { z } from "zod/v4"
import type { ZodOpenApiOperationObject } from "zod-openapi"
import * as Common from "../../../common"
import * as PostSchema from "../post"

export const PathParamsSchema = z.object({ id: z.string().min(1) }).strict()
export type PathParamsType = z.infer<typeof PathParamsSchema>

export const RequestBodySchema = PostSchema.RequestBodySchema
export type RequestBodyType = PostSchema.RequestBodyType
export const RequestBodyFieldKinds = PostSchema.RequestBodyFieldKinds
export const RequestHeaderSchema = PostSchema.RequestHeaderSchema

export const ResponseBody200Schema = PostSchema.ResponseBody200Schema
export type ResponseBody200Type = PostSchema.ResponseBody200Type

export const operation: ZodOpenApiOperationObject = {
    operationId: "updateSchedule",
    summary:
        "Replace the run time, content and images of an own pending scheduled post",
    requestParams: { header: RequestHeaderSchema, path: PathParamsSchema },
    requestBody: {
        required: true,
        content: { "multipart/form-data": { schema: RequestBodySchema } },
    },
    responses: {
        "200": {
            description: "Success",
            content: { "application/json": { schema: ResponseBody200Schema } },
        },
        ...Common.errorResponses(["400", "401", "404", "409", "500"]),
    },
}
