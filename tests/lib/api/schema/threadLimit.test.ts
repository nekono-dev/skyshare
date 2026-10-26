/**
 * スレッドの投稿数の上限（`threadLimit.ts`）を参照するスキーマと、
 * 生成したAPIドキュメントの入力定義が、検証用スキーマと一致することのテスト。
 */
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

import { buildOpenApiDocument } from "../../../../hack/build-openapi-document"
import { MAX_THREAD_POST_COUNT } from "@/lib/atproto/threadLimit"
import { RequestBodySchema as DraftCreateSchema } from "@/lib/api/schema/v2/bsky/drafts/post"
import { RequestBodySchema as DraftUpdateSchema } from "@/lib/api/schema/v2/bsky/drafts/put"
import { RequestBodySchema as EntryCreateSchema } from "@/lib/api/schema/v2/entry/post"

const SCHEMA_ROOT = join(__dirname, "../../../../src/lib/api/schema/v2")

type JsonSchema = {
    anyOf?: JsonSchema[]
    properties?: Record<string, JsonSchema>
    minItems?: number
    maxItems?: number
}

/** ドキュメントから、リクエストボディの `posts` 配列のスキーマを取り出す。 */
const postsSchemaOf = (path: string, method: "post" | "put"): JsonSchema => {
    const doc = buildOpenApiDocument() as unknown as {
        paths: Record<string, Record<string, any>>
    }
    const content = doc.paths[path][method].requestBody.content
    const root: JsonSchema = (
        content["application/json"] ?? content["multipart/form-data"]
    ).schema
    const candidates = root.anyOf ?? [root]
    const found = candidates.find(item => item.properties?.posts)
    return found!.properties!.posts
}

const TARGETS = [
    {
        name: "投稿の作成",
        path: "/v2/entry/",
        method: "post",
        file: "entry/post.ts",
        schema: EntryCreateSchema,
        extra: {},
    },
    {
        name: "下書きの作成",
        path: "/v2/bsky/drafts/",
        method: "post",
        file: "bsky/drafts/post.ts",
        schema: DraftCreateSchema,
        extra: {},
    },
    {
        name: "下書きの更新",
        path: "/v2/bsky/drafts/",
        method: "put",
        file: "bsky/drafts/put.ts",
        schema: DraftUpdateSchema,
        extra: { id: "draft-id" },
    },
] as const

/** 検証用の本文。更新のスキーマは下書きの識別子を必須とする。 */
const bodyWith = (count: number, extra: Record<string, unknown>) => ({
    posts: Array.from({ length: count }, () => ({ text: "a" })),
    ...extra,
})

describe.each(TARGETS)("$name のスレッドの上限", target => {
    it("[entry-api/2.6 draft-api/1.5] スキーマが共有の定数を参照し、ドキュメントの上限もその値になる", () => {
        const source = readFileSync(join(SCHEMA_ROOT, target.file), "utf8")
        expect(source).toMatch(
            /import \{ MAX_THREAD_POST_COUNT \} from "[^"]*atproto\/threadLimit"/,
        )
        expect(source).toContain("MAX_THREAD_POST_COUNT")
        expect(postsSchemaOf(target.path, target.method).maxItems).toBe(
            MAX_THREAD_POST_COUNT,
        )
    })

    it("[entry-api/5.4] ドキュメントの件数の範囲が、検証に使うスキーマの受理と拒否の境界と一致する", () => {
        const { minItems, maxItems } = postsSchemaOf(target.path, target.method)
        for (const count of [
            0,
            minItems!,
            maxItems!,
            minItems! - 1,
            maxItems! + 1,
        ]) {
            const accepted = target.schema.safeParse(
                bodyWith(count, target.extra),
            ).success
            expect(accepted, `${target.name} ${count}件`).toBe(
                count >= minItems! && count <= maxItems!,
            )
        }
    })
})
