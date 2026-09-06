/**
 * skyshare API の複数エンドポイントで共有される Zod スキーマ定義。
 *
 * 責務と処理概要:
 * - バリデーション(各APIルートの`.safeParse()`)とOpenAPIドキュメント生成
 *   (`hack/build-openapi-document.ts`)の両方から、このファイルのスキーマを
 *   直接importして使う「単一の真実の源」とする。
 */
import { z } from "zod/v4"
import type { ZodOpenApiResponsesObject } from "zod-openapi"

export const CommonOgMetaSchema = z
    .object({
        title: z.string().meta({ example: "" }),
        description: z.string().meta({ example: "" }),
        image: z
            .string()
            .optional()
            .meta({ example: "https://example.com/og.png" }),
        url: z.string().meta({
            description:
                "OGP取得元のページURL。app.bsky.embed.externalのuriに使う。",
            example: "https://example.com/article",
        }),
    })
    .strict()
export type CommonOgMetaType = z.infer<typeof CommonOgMetaSchema>

export const CommonErrorSchema = z
    .object({
        error: z.string().optional().meta({ example: "Invalid credentials" }),
    })
    .strict()
export type CommonErrorType = z.infer<typeof CommonErrorSchema>

export const CommonImagesMetaSchema = z.array(
    z
        .object({
            width: z.number().int().min(1),
            height: z.number().int().min(1),
        })
        .strict(),
)
export type CommonImagesMetaType = z.infer<typeof CommonImagesMetaSchema>

/**
 * 返信可能ユーザー設定(threadgate)・引用許可設定(postgate)の簡略化されたAPI契約。
 * Bluesky公式lexiconのunion型(allow配列の各要素が#mentionRule等のunion)を
 * クライアント側でboolean+配列に平坦化し、サーバ側でthreadgate/postgateレコードの
 * union形式へ復元する。
 */
export const CommonGateSettingsSchema = z
    .object({
        replyAudience: z.enum(["everyone", "nobody", "custom"]).meta({
            description:
                "everyone: 誰でも返信可能(allow未指定、threadgateレコード自体を作らない)。" +
                "nobody: 誰も返信不可(allow=[])。" +
                "custom: 以下のフラグ・リストの組み合わせでallowを構築する。",
        }),
        allowMentioned: z.boolean().meta({
            description:
                "customの場合のみ意味を持つ。メンションされた人からの返信を許可(#mentionRule)",
        }),
        allowFollower: z.boolean().meta({
            description:
                "customの場合のみ意味を持つ。フォロワーからの返信を許可(#followerRule)",
        }),
        allowFollowing: z.boolean().meta({
            description:
                "customの場合のみ意味を持つ。フォロー中の人からの返信を許可(#followingRule)",
        }),
        listUris: z
            .array(z.string())
            .max(5)
            .meta({
                description:
                    "customの場合のみ意味を持つ。返信を許可するリストのAT-URI配列(#listRule)。" +
                    "allowMentioned/allowFollower/allowFollowingと合計で最大5件(サーバ側でも防御的にclamp)。",
            }),
        allowQuote: z.boolean().meta({
            description:
                "引用/embedを許可するか(postgate)。falseの場合embeddingRulesに#disableRuleを設定。",
        }),
    })
    .strict()
export type CommonGateSettingsType = z.infer<typeof CommonGateSettingsSchema>

export const CommonCookieSchema = z
    .string()
    .meta({ example: "sid=abc123; Path=/; HttpOnly" })
export type CommonCookieType = z.infer<typeof CommonCookieSchema>

export const CommonLegacyPageErrorSchema = z
    .object({
        error: z.enum([
            "BadRequest",
            "RateLimitExceeded",
            "InternalServerError",
        ]),
    })
    .strict()
export type CommonLegacyPageErrorType = z.infer<
    typeof CommonLegacyPageErrorSchema
>

export const CommonLegacyPageEntrySchema = z
    .object({
        ogp: z.string(),
        handle: z.string(),
        imgs: z.array(
            z.object({ thumb: z.string(), alt: z.string() }).strict(),
        ),
    })
    .strict()
export type CommonLegacyPageEntryType = z.infer<
    typeof CommonLegacyPageEntrySchema
>

const ERROR_STATUS_DESCRIPTIONS: Record<string, string> = {
    "400": "Bad Request",
    "401": "Unauthorized",
    "403": "Forbidden",
    "404": "Not Found",
    "429": "Too Many Requests",
    "500": "Internal Server Error",
    "503": "Service Unavailable",
}

/**
 * 複数ステータスコードに共通のエラースキーマを割り当てたOpenAPI responses
 * フラグメントを組み立てる。
 *
 * 処理の趣旨:
 * - 各エンドポイントのエラーレスポンス(400/401/404/429/500等)は、いずれも
 *   同一のエラースキーマ(既定は`CommonErrorSchema`)を指すだけの反復になりがち。
 *   これを全operationファイルで個別に再エクスポートさせず、ここに一本化する。
 *
 * Input:
 * - `statuses`: 対象ステータスコード文字列の配列(例: `["400", "401", "500"]`)
 * - `schema`: エラーレスポンスのスキーマ(既定: `CommonErrorSchema`)
 *
 * Output:
 * - `operation.responses` にスプレッドできるresponsesフラグメント
 *
 * 例:
 * - 入力: `errorResponses(["400", "401"])`
 * - 出力: `{ "400": { description: "Bad Request", ... }, "401": { description: "Unauthorized", ... } }`
 */
export const errorResponses = (
    statuses: string[],
    schema: z.ZodTypeAny = CommonErrorSchema,
): ZodOpenApiResponsesObject => {
    const responses: ZodOpenApiResponsesObject = {}
    for (const status of statuses) {
        responses[status] = {
            description: ERROR_STATUS_DESCRIPTIONS[status] ?? "Error",
            content: { "application/json": { schema } },
        }
    }
    return responses
}
