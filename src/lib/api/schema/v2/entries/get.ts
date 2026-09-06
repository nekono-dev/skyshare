/**
 * GET /v2/entries/ — 自分のBluesky投稿一覧を、紐づくskyshare entryとembedして返す。
 *
 * バリデーションとOpenAPIドキュメント生成の両方から参照される単一の真実の源。
 */
import { z } from "zod/v4"
import type { ZodOpenApiOperationObject } from "zod-openapi"
import * as Common from "../../common"

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
        posts: z.array(
            z
                .object({
                    uri: z.string(),
                    cid: z.string(),
                    url: z.string(),
                    indexedAt: z.string(),
                    text: z.string(),
                    author: z
                        .object({
                            did: z.string(),
                            handle: z.string(),
                            displayName: z.string().optional(),
                            avatar: z.string().optional(),
                        })
                        .strict(),
                    images: z.array(
                        z
                            .object({
                                url: z.string(),
                                alt: z.string(),
                                cid: z.string(),
                            })
                            .strict(),
                    ),
                    skyshareEntry: z
                        .object({
                            uri: z.string(),
                            cid: z.string(),
                            createdAt: z.string(),
                            sourceUri: z.string(),
                            sourceCid: z.string(),
                            heading: z.string().optional(),
                            caption: z.string().optional(),
                            visualUrl: z.string().optional(),
                            webUrl: z.string().optional(),
                        })
                        .strict()
                        .optional(),
                })
                .strict(),
        ),
    })
    .strict()
export type ResponseBody200Type = z.infer<typeof ResponseBody200Schema>

export const operation: ZodOpenApiOperationObject = {
    operationId: "getEntries",
    summary: "Get own Bluesky posts with attached Skyshare entries",
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
