/**
 * POST /v2/bsky/session/authorization/ — Bluesky の OAuth によるログインを開始する。
 *
 * ユーザー名を受け取らずに Bluesky の認可サーバーへ認可の要求を事前に送り、利用者を送る認可の画面の住所を返す。
 * 再ログインでは `loginHint` のハンドルを認可の画面で入力済みにする。`returnTo` は認可の画面から戻ったときに
 * 表示するページ（同じオリジンのパス）で、戻り先だけに送られる cookie に入る。
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
        loginHint: z.string().min(1).max(253).optional(),
    })
    .strict()
export type RequestBodyType = z.infer<typeof RequestBodySchema>

export const ResponseBody200Schema = z.object({ url: z.string() }).strict()
export type ResponseBody200Type = z.infer<typeof ResponseBody200Schema>

export const operation: ZodOpenApiOperationObject = {
    operationId: "startSessionAuthorization",
    summary: "Start logging in with Bluesky OAuth without asking for the handle",
    requestBody: {
        required: false,
        content: { "application/json": { schema: RequestBodySchema } },
    },
    responses: {
        "200": {
            description: "The URL of the authorization page",
            content: { "application/json": { schema: ResponseBody200Schema } },
        },
        ...Common.errorResponses(["400", "500", "502"]),
    },
}
