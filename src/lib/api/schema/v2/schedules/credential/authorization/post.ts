/**
 * POST /v2/schedules/credential/authorization/ — 予約投稿の OAuth の認可を開始する。
 *
 * ログイン中のアカウントで認可の要求を作り、利用者を送る認可の画面の URL を返す。
 * ユーザー名は受け取らない（ログイン中のアカウントを使う）。
 * 本文の `returnTo` は、認可の画面から戻ったときに表示するページのパス（省略時は設定のページ）。
 */
import { z } from "zod/v4"
import type { ZodOpenApiOperationObject } from "zod-openapi"
import * as Common from "../../../../common"
import { isSafeReturnPath } from "../../../../../../oauth/returnPath"

export const RequestBodySchema = z
    .object({
        returnTo: z
            .string()
            .refine(isSafeReturnPath, "same-origin path only")
            .optional(),
    })
    .strict()
export type RequestBodyType = z.infer<typeof RequestBodySchema>

export const ResponseBody200Schema = z.object({ url: z.string() }).strict()
export type ResponseBody200Type = z.infer<typeof ResponseBody200Schema>

export const operation: ZodOpenApiOperationObject = {
    operationId: "startScheduleAuthorization",
    summary:
        "Start the OAuth authorization of the logged-in account for scheduled posts",
    requestBody: {
        required: false,
        content: { "application/json": { schema: RequestBodySchema } },
    },
    responses: {
        "200": {
            description: "Success",
            content: { "application/json": { schema: ResponseBody200Schema } },
        },
        ...Common.errorResponses(["400", "401", "500", "502"]),
    },
}
