/**
 * GET /v2/entries/skyshare/ — 自分のskyshare entry一覧を、元投稿が現存するかの
 * フラグ(orphaned)付きで返す。
 *
 * バリデーションとOpenAPIドキュメント生成の両方から参照される単一の真実の源。
 */
import { z } from "zod/v4"
import type { ZodOpenApiOperationObject } from "zod-openapi"
import * as Common from "../../../common"

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
        entries: z.array(
            z
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
                    orphaned: z.boolean(),
                })
                .strict(),
        ),
    })
    .strict()
export type ResponseBody200Type = z.infer<typeof ResponseBody200Schema>

export const operation: ZodOpenApiOperationObject = {
    operationId: "getSkyshareEntries",
    summary:
        "Get own Skyshare entries, each annotated with whether its source Bluesky post still exists",
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
