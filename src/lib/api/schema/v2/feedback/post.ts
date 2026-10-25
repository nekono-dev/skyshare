/**
 * POST /v2/feedback/ — 不具合の報告か新機能の提案を受け付け、GitHub の Issue として登録する。
 *
 * バリデーションとOpenAPIドキュメント生成の両方から参照される単一の真実の源。
 * 入力は種別（`kind`）で分岐し、strict で他の種別の項目と未知の項目（報告者の DID など）を拒否する。
 * 報告者はログインのセッションから決めるため、入力には含めない。
 */
import { z } from "zod/v4"
import type { ZodOpenApiOperationObject } from "zod-openapi"
import {
    FEEDBACK_LIMITS,
    REPRODUCIBILITY_VALUES,
    countFeedbackLength,
} from "../../../../feedback/limits"
import * as Common from "../../common"

/**
 * 空白だけでなく、書記素で数えて `max` 文字以内の文字列のスキーマを作る。
 *
 * Input:
 * - `max`: 書記素で数えた文字数の上限
 *
 * Output:
 * - 文字列のスキーマ（画面の文字数カウンタと同じ数え方）
 *
 * 例:
 * - 入力: `requiredText(100)` → 出力: " " と101文字を拒否し、絵文字100個を受け入れるスキーマ
 */
const requiredText = (max: number) =>
    z
        .string()
        .refine(value => value.trim() !== "", { message: "blank" })
        .refine(value => countFeedbackLength(value) <= max, {
            message: "too long",
        })
        .meta({ description: `Non-blank, up to ${max} graphemes` })

/** 画面が自動で集めた環境の情報 */
const EnvironmentSchema = z
    .object({
        os: z.string().max(100),
        browser: z.string().max(100),
        userAgent: z.string().max(1000),
        /** ホーム画面から起動したか（PWA） */
        standalone: z.boolean(),
        /** 画面のビルドの版 */
        version: z.string().max(50),
        /** 画面のビルドのコミット。不明なら空文字 */
        commit: z.string().max(64),
    })
    .strict()

const common = {
    title: requiredText(FEEDBACK_LIMITS.title),
    environment: EnvironmentSchema,
}

export const RequestBodySchema = z.discriminatedUnion("kind", [
    z
        .object({
            kind: z.literal("bug"),
            ...common,
            steps: requiredText(FEEDBACK_LIMITS.text),
            reproducibility: z.enum(REPRODUCIBILITY_VALUES),
        })
        .strict(),
    z
        .object({
            kind: z.literal("enhancement"),
            ...common,
            description: requiredText(FEEDBACK_LIMITS.text),
            technicalNotes: requiredText(FEEDBACK_LIMITS.text).optional(),
        })
        .strict(),
])
export type RequestBodyType = z.infer<typeof RequestBodySchema>

export const RequestHeaderSchema = z.object({
    cookie: Common.CommonCookieSchema,
})
export type RequestHeaderType = z.infer<typeof RequestHeaderSchema>

export const ResponseBody200Schema = z
    .object({ number: z.number().int(), url: z.string() })
    .strict()
export type ResponseBody200Type = z.infer<typeof ResponseBody200Schema>

export const operation: ZodOpenApiOperationObject = {
    operationId: "createFeedback",
    summary:
        "Submit a bug report or a feature request as a GitHub issue (one per minute per account)",
    requestParams: { header: RequestHeaderSchema },
    requestBody: {
        required: true,
        content: { "application/json": { schema: RequestBodySchema } },
    },
    responses: {
        "200": {
            description: "Success",
            content: { "application/json": { schema: ResponseBody200Schema } },
        },
        ...Common.errorResponses(["400", "401", "429", "500", "503"]),
    },
}
