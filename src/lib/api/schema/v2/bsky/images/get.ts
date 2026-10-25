/**
 * GET /v2/bsky/images/ — 自分のPDSから生の画像blobを取得する(Bluesky CDNはCORSヘッダを
 * 持たないためバイパスする)。
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

export const QueryParamsSchema = z.object({ cid: z.string() }).strict()
export type QueryParamsType = z.infer<typeof QueryParamsSchema>

export const operation: ZodOpenApiOperationObject = {
    operationId: "getBskyImage",
    summary:
        "Fetch a raw image blob from the caller's own PDS (bypasses Bluesky CDN, which lacks CORS headers)",
    requestParams: {
        header: RequestHeaderSchema,
        query: QueryParamsSchema,
    },
    responses: {
        "200": {
            description: "Success",
            content: {
                "image/*": { schema: { type: "string", format: "binary" } },
            },
        },
        ...Common.errorResponses(["400", "401", "404", "500"]),
    },
}
