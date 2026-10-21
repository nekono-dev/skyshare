/**
 * DELETE /v2/bsky/session/{did}/ — アカウントをログアウトする(アクティブセッションまたはプールされたアカウントから削除)。
 *
 * バリデーションとOpenAPIドキュメント生成の両方から参照される単一の真実の源。
 */
import { z } from "zod/v4"
import type { ZodOpenApiOperationObject } from "zod-openapi"
import * as Common from "../../../../common"

export const PathParamsSchema = z.object({ did: z.string() }).strict()
export type PathParamsType = z.infer<typeof PathParamsSchema>

export const operation: ZodOpenApiOperationObject = {
    operationId: "deleteSession",
    summary:
        "Log out an account (removes it from the active session or the pooled accounts)",
    requestParams: { path: PathParamsSchema },
    responses: {
        "200": { description: "Success" },
        ...Common.errorResponses(["401", "404", "500"]),
    },
}
