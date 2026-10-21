/**
 * POST /v2/bsky/video/upload-token — 動画アップロード用のサービス認証トークンを発行する。
 *
 * 動画の実体はブラウザから Bluesky の動画サービスへ直接送るため、Skyshare は
 * 短命のトークン発行のみを担う（NFR-1・NFR-2）。
 *
 * バリデーションとOpenAPIドキュメント生成の両方から参照される単一の真実の源。
 */
import { z } from "zod/v4"
import type { ZodOpenApiOperationObject } from "zod-openapi"
import * as Common from "../../../../common"

export const RequestHeaderSchema = z.object({
    cookie: Common.CommonCookieSchema,
})
export type RequestHeaderType = z.infer<typeof RequestHeaderSchema>

export const ResponseBody200Schema = z
    .object({
        token: z.string().min(1),
        // 利用者の DID
        did: z.string(),
        // トークンの有効期限（UNIX 秒）
        expiresAt: z.number().int(),
    })
    .strict()
export type ResponseBody200Type = z.infer<typeof ResponseBody200Schema>

export const operation: ZodOpenApiOperationObject = {
    operationId: "createBskyVideoUploadToken",
    summary:
        "Issue a short-lived service auth token for uploading a video to the Bluesky video service",
    requestParams: {
        header: RequestHeaderSchema,
    },
    responses: {
        "200": {
            description: "Success",
            content: { "application/json": { schema: ResponseBody200Schema } },
        },
        // 400: 対応PDS（bsky.social 系）以外のアカウント
        ...Common.errorResponses(["400", "401", "429", "500"]),
    },
}
