/**
 * POST /v2/schedules/ — 投稿（1件、またはスレッドとして複数件）を、実行時刻を指定して予約する。
 *
 * 入力は投稿の作成（/v2/entry/）の新規投稿と同じ multipart/form-data で、
 * 動画の分岐を除いた3分岐の投稿の配列と、`runAt`（タイムゾーンの差を含む ISO 8601）を持つ。
 * バリデーションとOpenAPIドキュメント生成の両方から参照される単一の真実の源。
 */
import { z } from "zod/v4"
import type { ZodOpenApiOperationObject } from "zod-openapi"
import type { FormDataFieldKind } from "@/util/formData"
import { MAX_THREAD_POST_COUNT } from "../../../../atproto/threadLimit"
import * as Common from "../../common"
import { EntryPostItemSchema, PostItemFieldKinds } from "../entry/post"

const imageField = z.instanceof(Blob).meta({ type: "string", format: "binary" })
const [textOnly, withLink, withImages] = EntryPostItemSchema.options

/** 投稿の作成の入力から、動画の分岐を除いた3分岐 */
export const SchedulePostItemSchema = z.union([textOnly, withLink, withImages])

export const RequestBodySchema = z
    .object({
        posts: z
            .array(SchedulePostItemSchema)
            .min(1)
            .max(MAX_THREAD_POST_COUNT),
        runAt: z.iso.datetime({ offset: true }),
        reply: Common.CommonReplyRefSchema.optional(),
        createEntry: z.boolean().optional(),
        visual: imageField.optional(),
        heading: z.string().max(100).optional(),
        caption: z.string().max(300).optional(),
    })
    .strict()
export type RequestBodyType = z.infer<typeof RequestBodySchema>

export const RequestBodyFieldKinds: Record<string, FormDataFieldKind> = {
    runAt: "text",
    visual: "file",
    heading: "json",
    caption: "json",
    reply: "json",
    createEntry: "json",
    posts: { kind: "items", itemFieldKinds: PostItemFieldKinds },
}

export const RequestHeaderSchema = z.object({
    cookie: Common.CommonCookieSchema,
})

export const ResponseBody200Schema = z
    .object({ id: z.string(), runAt: z.string() })
    .strict()
export type ResponseBody200Type = z.infer<typeof ResponseBody200Schema>

export const operation: ZodOpenApiOperationObject = {
    operationId: "createSchedule",
    summary:
        "Schedule one or more Bluesky posts (optionally as a thread with an entry) to be posted at the given time",
    requestParams: { header: RequestHeaderSchema },
    requestBody: {
        required: true,
        content: { "multipart/form-data": { schema: RequestBodySchema } },
    },
    responses: {
        "200": {
            description: "Success",
            content: { "application/json": { schema: ResponseBody200Schema } },
        },
        ...Common.errorResponses(["400", "401", "409", "429", "500"]),
    },
}
