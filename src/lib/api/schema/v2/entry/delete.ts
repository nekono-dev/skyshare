/**
 * DELETE /v2/entry/ — skyshare entry(dev.nekono.skyshare.entry)を削除する。
 * オプションで、紐づくBluesky投稿も削除する。
 *
 * バリデーションとOpenAPIドキュメント生成の両方から参照される単一の真実の源。
 */
import { z } from "zod/v4"
import type { ZodOpenApiOperationObject } from "zod-openapi"
import * as Common from "../../common"

/**
 * `deleteBskyThread:true`は`deleteBskyPost:true`とあわせて指定された場合にのみ意味を持つ。
 * `deleteBskyPost`がtrueでないのに`deleteBskyThread:true`のみが指定された場合は
 * スキーマ不正として拒否する（`specs/entry/backend/design.md §5.1`）。
 */
export const RequestBodySchema = z
    .object({
        uri: z.string(),
        deleteBskyPost: z.boolean().optional(),
        deleteBskyThread: z.boolean().optional(),
    })
    .strict()
    .refine(data => !data.deleteBskyThread || data.deleteBskyPost === true, {
        message: "deleteBskyThread requires deleteBskyPost to be true",
        path: ["deleteBskyThread"],
    })
export type RequestBodyType = z.infer<typeof RequestBodySchema>

export const RequestHeaderSchema = z.object({
    cookie: Common.CommonCookieSchema,
})
export type RequestHeaderType = z.infer<typeof RequestHeaderSchema>

export const operation: ZodOpenApiOperationObject = {
    operationId: "deleteEntry",
    summary:
        "Delete a Skyshare entry (dev.nekono.skyshare.entry). Optionally also deletes the underlying Bluesky post.",
    requestParams: { header: RequestHeaderSchema },
    requestBody: {
        required: true,
        content: { "application/json": { schema: RequestBodySchema } },
    },
    responses: {
        "200": { description: "Success" },
        ...Common.errorResponses(["400", "401", "404", "429", "500"]),
    },
}
