/**
 * POST /v2/bsky/drafts/ — Blueskyの下書きを新規作成する。
 *
 * バリデーションとOpenAPIドキュメント生成の両方から参照される単一の真実の源。
 * `posts` は1件ならテキストのみの下書き、複数件ならスレッド(reply chain予定)の
 * 下書きを表す（`app.bsky.draft#draft.posts` にそのまま対応）。
 */
import { z } from "zod/v4"
import type { ZodOpenApiOperationObject } from "zod-openapi"
import * as Common from "../../../common"

export const DraftPostSchema = z
    .object({ text: z.string(), labels: z.array(z.string()).optional() })
    .strict()
export type DraftPostType = z.infer<typeof DraftPostSchema>

export const RequestBodySchema = z
    .object({ posts: z.array(DraftPostSchema).min(1).max(100) })
    .strict()
export type RequestBodyType = z.infer<typeof RequestBodySchema>

export const RequestHeaderSchema = z.object({
    cookie: Common.CommonCookieSchema,
})
export type RequestHeaderType = z.infer<typeof RequestHeaderSchema>

export const ResponseBody200Schema = z.object({ id: z.string() }).strict()
export type ResponseBody200Type = z.infer<typeof ResponseBody200Schema>

export const operation: ZodOpenApiOperationObject = {
    operationId: "createDraft",
    summary: "Create a new Bluesky draft",
    requestParams: { header: RequestHeaderSchema },
    requestBody: {
        required: true,
        content: { "application/json": { schema: RequestBodySchema } },
    },
    responses: {
        "200": {
            description: "Success",
            content: { "application/json": { schema: ResponseBody200Schema } },
        },
        ...Common.errorResponses(["400", "401", "429", "500"]),
    },
}
