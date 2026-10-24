/**
 * POST /v2/bsky/session/authorization/completion/ — Bluesky の OAuth によるログインを完了する。
 *
 * 認可の画面からの戻りの項目（`/oauth/callback/` が許可を始めたページへ渡したもの）を受け、
 * 認可コードをトークンに替えて OAuth のセッションを作り、セッションの cookie を設定する。
 * 結果は `ok` か失敗の分類。アカウント数の上限は 409。戻りは別のサイトからの遷移で
 * `SameSite=Strict` の cookie が届かないため、同じサイトのページからこの API を呼ぶ。
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
            "TokenFailed",
            "AccountUnverified",
            "NotConfigured",
        ]),
    })
    .strict()
export type ResponseBody200Type = z.infer<typeof ResponseBody200Schema>

export const operation: ZodOpenApiOperationObject = {
    operationId: "completeSessionAuthorization",
    summary: "Complete logging in with Bluesky OAuth with the callback parameters",
    requestBody: {
        content: { "application/json": { schema: RequestBodySchema } },
    },
    responses: {
        "200": {
            description: "The result of the login",
            content: { "application/json": { schema: ResponseBody200Schema } },
        },
        ...Common.errorResponses(["400", "409", "500"]),
    },
}
