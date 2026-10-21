/**
 * GET /v2/bsky/session/ — このブラウザに紐づくアカウント一覧(アクティブセッション+プールされたアカウント)を返す。
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

export const ResponseBody200Schema = z
    .object({
        accounts: z.array(
            z
                .object({
                    did: z.string(),
                    handle: z.string(),
                    displayName: z.string().optional(),
                    avatarUrl: z.string().optional(),
                    isActive: z.boolean(),
                })
                .strict(),
        ),
    })
    .strict()
export type ResponseBody200Type = z.infer<typeof ResponseBody200Schema>

export const operation: ZodOpenApiOperationObject = {
    operationId: "getSession",
    summary:
        "List accounts linked in this browser (active session + pooled accounts)",
    requestParams: { header: RequestHeaderSchema },
    responses: {
        "200": {
            description: "Success",
            content: { "application/json": { schema: ResponseBody200Schema } },
        },
        ...Common.errorResponses(["401", "500"]),
    },
}
