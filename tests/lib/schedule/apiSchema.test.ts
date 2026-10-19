import { describe, expect, test } from "vitest"
import { paths } from "@/lib/api/schema/index"
import * as Post from "@/lib/api/schema/v2/schedules/post"
import * as Get from "@/lib/api/schema/v2/schedules/get"
import * as Del from "@/lib/api/schema/v2/schedules/_id/delete"

type Op = {
    requestBody?: { content: Record<string, { schema: unknown }> }
    requestParams?: { query?: unknown; path?: unknown }
}

describe("予約投稿 API のスキーマ", () => {
    test("schedule-api/AC-13: 作成・一覧・取消の入力スキーマが API 文書の生成に使われる定義と同一", () => {
        const post = (paths["/v2/schedules/"] as { post: Op }).post
        expect(post.requestBody!.content["multipart/form-data"]!.schema).toBe(
            Post.RequestBodySchema,
        )
        const get = (paths["/v2/schedules/"] as { get: Op }).get
        expect(get.requestParams!.query).toBe(Get.QuerySchema)
        const del = (paths["/v2/schedules/{id}/"] as { delete: Op }).delete
        expect(del.requestParams!.path).toBe(Del.PathParamsSchema)
    })
})
