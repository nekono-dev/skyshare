/**
 * PUT /v2/surveys/{surveyId}/respondent/ — ログイン中の利用者を、そのアンケートの回答済みとして登録する。
 *
 * バリデーションとOpenAPIドキュメント生成の両方から参照される単一の真実の源。
 * 回答は受け取らない（本文なし）。成功は内容のない 204。
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

export const operation: ZodOpenApiOperationObject = {
    operationId: "putSurveyRespondent",
    summary: "Register the signed-in user as having answered the survey",
    requestParams: { header: RequestHeaderSchema, path: PathParamsSchema },
    responses: {
        "204": { description: "No Content" },
        ...Common.errorResponses(["400", "401", "404", "500", "503"]),
    },
}
