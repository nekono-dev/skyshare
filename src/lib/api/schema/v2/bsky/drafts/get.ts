/**
 * GET /v2/bsky/drafts/ — Blueskyの下書き一覧を取得する。
 *
 * バリデーションとOpenAPIドキュメント生成の両方から参照される単一の真実の源。
 */
import { z } from "zod/v4"
import type { ZodOpenApiOperationObject } from "zod-openapi"
import { MAX_THREAD_POST_COUNT } from "@/lib/atproto/post"
import * as Common from "../../../common"
import { DraftPostSchema } from "./post"

export const RequestHeaderSchema = z.object({
    cookie: Common.CommonCookieSchema,
})
export type RequestHeaderType = z.infer<typeof RequestHeaderSchema>

export const QueryParamsSchema = z
    .object({ limit: z.number().optional(), cursor: z.string().optional() })
    .strict()
export type QueryParamsType = z.infer<typeof QueryParamsSchema>

export const ResponseBody200Schema = z
    .object({
        cursor: z.string().optional(),
        drafts: z.array(
            z
                .object({
                    id: z.string(),
                    posts: z
                        .array(DraftPostSchema)
                        .min(1)
                        .max(MAX_THREAD_POST_COUNT),
                    createdAt: z.string(),
                    updatedAt: z.string(),
                })
                .strict(),
        ),
    })
    .strict()
export type ResponseBody200Type = z.infer<typeof ResponseBody200Schema>

export const operation: ZodOpenApiOperationObject = {
    operationId: "getDrafts",
    summary: "Get draft list from Bluesky",
    requestParams: {
        header: RequestHeaderSchema,
        query: QueryParamsSchema,
    },
    responses: {
        "200": {
            description: "Success",
            content: { "application/json": { schema: ResponseBody200Schema } },
        },
        ...Common.errorResponses(["400", "401", "429", "500"]),
    },
}
