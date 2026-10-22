/**
 * PUT /v2/schedules/credential/ — アプリパスワードでログインし、予約用の認証情報を登録する。
 *
 * パスワードは保管しない。ログインで得た更新用トークンだけを暗号化して保管する。
 */
import { z } from "zod/v4"
import type { ZodOpenApiOperationObject } from "zod-openapi"
import * as Common from "../../../common"

export const RequestBodySchema = z
    .object({ password: z.string().min(1) })
    .strict()
export type RequestBodyType = z.infer<typeof RequestBodySchema>

export const ResponseBody200Schema = z
    .object({ registered: z.literal(true) })
    .strict()
export type ResponseBody200Type = z.infer<typeof ResponseBody200Schema>

export const operation: ZodOpenApiOperationObject = {
    operationId: "putScheduleCredential",
    summary:
        "Register the credential for scheduled posts by logging in with an app password",
    requestBody: {
        required: true,
        content: { "application/json": { schema: RequestBodySchema } },
    },
    responses: {
        "200": {
            description: "Success",
            content: { "application/json": { schema: ResponseBody200Schema } },
        },
        ...Common.errorResponses(["400", "401", "429", "500"]),
    },
}
