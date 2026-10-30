/**
 * POST /v2/surveys/{surveyId}/answers/ — アンケートの回答を匿名で保存する。
 *
 * バリデーションとOpenAPIドキュメント生成の両方から参照される単一の真実の源。
 * 本文は質問ごとの選択結果だけで、回答者の識別子や時刻を持たない。定義にない項目は拒否する。
 * 設定との突き合わせ（質問・選択肢の存在、件数の規則）は回答の検証処理が行う。成功は内容のない 201。
 */
import { z } from "zod/v4"
import type { ZodOpenApiOperationObject } from "zod-openapi"
import * as Common from "../../../../common"
import { idSchema } from "../../../../../../survey/definition"
import { PathParamsSchema } from "../path"

export { PathParamsSchema }
export type { PathParamsType } from "../path"

/** 1 回の回答に含められる質問の数の上限 */
export const MAX_ANSWER_QUESTIONS = 50

/** 1 つの質問で選べる選択肢の数の上限 */
export const MAX_ANSWER_CHOICES = 50

export const RequestHeaderSchema = z.object({
    cookie: Common.CommonCookieSchema,
})

export const RequestBodySchema = z
    .object({
        answers: z
            .record(
                idSchema,
                z.union([idSchema, z.array(idSchema).max(MAX_ANSWER_CHOICES)]),
            )
            .refine(
                answers => Object.keys(answers).length <= MAX_ANSWER_QUESTIONS,
                { message: "質問の数が上限を超えている" },
            )
            .meta({
                description:
                    "質問の識別子から選択肢の識別子（単一選択は文字列、複数選択は配列）への対応。",
            }),
    })
    .strict()
    .meta({ id: "SurveyAnswersRequest" })
export type RequestBodyType = z.infer<typeof RequestBodySchema>

export const operation: ZodOpenApiOperationObject = {
    operationId: "postSurveyAnswers",
    summary: "Save an anonymous answer to the survey",
    requestParams: { header: RequestHeaderSchema, path: PathParamsSchema },
    requestBody: {
        required: true,
        content: { "application/json": { schema: RequestBodySchema } },
    },
    responses: {
        "201": { description: "Created" },
        ...Common.errorResponses([
            "400",
            "401",
            "404",
            "409",
            "422",
            "500",
            "503",
        ]),
    },
}
