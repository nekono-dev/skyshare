/**
 * GET /v2/schedules/{id}/ — 自分の待機中または失敗の予約の内容を、フォームへの書き戻しのために取得する。
 *
 * バリデーションとOpenAPIドキュメント生成の両方から参照される単一の真実の源。
 * 画像は番号だけを返し、バイト列は GET /v2/schedules/{id}/images/{index}/ で取得する。
 */
import { z } from "zod/v4"
import type { ZodOpenApiOperationObject } from "zod-openapi"
import * as Common from "../../../common"

export const PathParamsSchema = z.object({ id: z.string().min(1) }).strict()
export type PathParamsType = z.infer<typeof PathParamsSchema>

/** 予約した投稿1件分。作成時の入力から facets を除き、画像を番号に置き換えた形 */
export const ScheduleDetailPostSchema = z
    .object({
        text: z.string().optional(),
        langs: z.array(z.string()).optional(),
        selfLabels: z.string().optional(),
        gate: Common.CommonGateSettingsSchema.optional(),
        ogMeta: Common.CommonOgMetaSchema.optional(),
        imagesMeta: Common.CommonImagesMetaSchema.optional(),
        images: z.array(z.number().int().min(0)).optional(),
        ogImage: z.number().int().min(0).optional(),
    })
    .meta({ id: "ScheduleDetailPost" })

export const ResponseBody200Schema = z
    .object({
        id: z.string(),
        /** pending は待機中の予約（編集して置き換える）、failed は失敗した予約（書き戻して新規に送る） */
        status: z.enum(["pending", "failed"]),
        runAt: z.string(),
        posts: z.array(ScheduleDetailPostSchema),
        reply: Common.CommonReplyRefSchema.optional(),
        createEntry: z.boolean().optional(),
        visual: z.number().int().min(0).optional(),
        heading: z.string().optional(),
        caption: z.string().optional(),
    })
    .meta({ id: "ScheduleDetail" })
export type ResponseBody200Type = z.infer<typeof ResponseBody200Schema>

export const operation: ZodOpenApiOperationObject = {
    operationId: "getSchedule",
    summary:
        "Get the content of an own pending or failed scheduled post to restore it into the form",
    requestParams: { path: PathParamsSchema },
    responses: {
        "200": {
            description: "Success",
            content: { "application/json": { schema: ResponseBody200Schema } },
        },
        ...Common.errorResponses(["400", "401", "404", "409", "500"]),
    },
}
