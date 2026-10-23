/**
 * POST /v2/schedules/credential/authorization/completion/ — 予約投稿の OAuth の認可を完了する。
 *
 * 認可の画面からの戻りの項目（`/oauth/callback/` が設定のページへ渡したもの）を受け、
 * 認可コードをトークンに替えて保管し、結果を返す。結果は `ok` か失敗の分類。
 * 戻りは別のサイトからの遷移でセッションの cookie が届かないため、同じサイトの
 * 設定のページからこの API を呼ぶ。
 */
import { z } from "zod/v4"
import type { ZodOpenApiOperationObject } from "zod-openapi"
import * as Common from "../../../../../common"

/** 認可サーバーが戻りに付けた項目 */
export const RequestBodySchema = z
    .object({
        code: z.string().min(1).optional(),
        state: z.string().min(1).optional(),
        iss: z.string().min(1).optional(),
        error: z.string().min(1).optional(),
    })
    .strict()
export type RequestBodyType = z.infer<typeof RequestBodySchema>

export const ResponseBody200Schema = z
    .object({
        result: z.enum([
            "ok",
            "Denied",
            "StateInvalid",
            "IssuerMismatch",
            "AccountMismatch",
            "TokenFailed",
            "NotConfigured",
        ]),
    })
    .strict()
export type ResponseBody200Type = z.infer<typeof ResponseBody200Schema>

export const operation: ZodOpenApiOperationObject = {
    operationId: "completeScheduleAuthorization",
    summary:
        "Complete the OAuth authorization for scheduled posts with the callback parameters",
    requestBody: {
        content: { "application/json": { schema: RequestBodySchema } },
    },
    responses: {
        "200": {
            description: "The result of the authorization",
            content: { "application/json": { schema: ResponseBody200Schema } },
        },
        ...Common.errorResponses(["400", "401", "500"]),
    },
}
