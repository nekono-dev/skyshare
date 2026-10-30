/**
 * GET /v2/surveys/{surveyId}/respondent/ — ログイン中の利用者がそのアンケートに回答済みかを返す。
 *
 * バリデーションとOpenAPIドキュメント生成の両方から参照される単一の真実の源。
 * 結果は回答済みかの真偽だけで、内容も時刻も返さない。
 */
import { z } from "zod/v4"
import type { ZodOpenApiOperationObject } from "zod-openapi"
import * as Common from "../../../../common"
import { PathParamsSchema } from "../path"

export { PathParamsSchema }
export type { PathParamsType } from "../path"

export const RequestHeaderSchema = z.object({
    cookie: Common.CommonCookieSchema,
})

export const ResponseBody200Schema = z
    .object({ answered: z.boolean() })
    .strict()
    .meta({ id: "SurveyRespondent" })
export type ResponseBody200Type = z.infer<typeof ResponseBody200Schema>

export const operation: ZodOpenApiOperationObject = {
    operationId: "getSurveyRespondent",
    summary: "Check whether the signed-in user has answered the survey",
    requestParams: { header: RequestHeaderSchema, path: PathParamsSchema },
    responses: {
        "200": {
            description: "Success",
            content: { "application/json": { schema: ResponseBody200Schema } },
        },
        ...Common.errorResponses(["400", "401", "404", "500", "503"]),
    },
}
