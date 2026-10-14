/**
 * `src/lib/api/schema/v1/extract/get.ts` のスキーマのテスト。
 *
 * 責務と処理概要:
 * - OGP抽出APIのクエリがURLだけを受け付けること、応答がOGPのメタ情報の形であることを確認する。
 */
import { describe, expect, it } from "vitest"

import * as ExtractSchema from "@/lib/api/schema/v1/extract/get"

describe("v1/extract GET スキーマ", () => {
    it("[ogp-link-card/AC-4] クエリはURLだけを受け付け、他のキーは拒否する", () => {
        expect(
            ExtractSchema.QueryParamsSchema.safeParse({
                url: "https://example.com",
            }).success,
        ).toBe(true)
        expect(
            ExtractSchema.QueryParamsSchema.safeParse({
                url: "https://example.com",
                extra: "x",
            }).success,
        ).toBe(false)
    })

    it("[ogp-link-card/AC-5] 応答は、画像を省略したOGPのメタ情報を受け付ける", () => {
        const base = {
            title: "t",
            description: "d",
            url: "https://example.com",
        }
        expect(
            ExtractSchema.ResponseBody200Schema.safeParse(base).success,
        ).toBe(true)
        expect(
            ExtractSchema.ResponseBody200Schema.safeParse({
                ...base,
                image: "https://example.com/og.png",
            }).success,
        ).toBe(true)
        expect(
            ExtractSchema.ResponseBody200Schema.safeParse({ title: "t" })
                .success,
        ).toBe(false)
    })
})
