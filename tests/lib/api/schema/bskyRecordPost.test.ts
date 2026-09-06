/**
 * `src/lib/api/schema/v2/bsky/record/post.ts` の `RequestBodySchema` のテスト。
 *
 * 責務と処理概要:
 * - multipart+anyOfの力技(`.superRefine`によるOR判定)をネイティブな`z.union`に
 *   置き換えたため、3つの分岐(テキストのみ/OGPリンク付き/画像付き)それぞれが
 *   引き続き正しく検証されることを直接確認する。
 */
import { describe, expect, it } from "vitest"

import { formDataToObject } from "@/util/formData"
import * as PostSchema from "@/lib/api/schema/v2/bsky/record/post"

describe("v2/bsky/record POST RequestBodySchema", () => {
    it("テキストのみの投稿分岐を受理する", () => {
        const formData = new FormData()
        formData.set("text", "hello")
        const raw = formDataToObject(formData, PostSchema.RequestBodyFieldKinds)
        const result = PostSchema.RequestBodySchema.safeParse(raw)
        expect(result.success).toBe(true)
    })

    it("OGPリンク付き投稿分岐(ogImage + ogMeta)を受理する", () => {
        const formData = new FormData()
        formData.set("ogImage", new Blob(["x"], { type: "image/png" }))
        formData.set(
            "ogMeta",
            JSON.stringify({
                title: "t",
                description: "d",
                url: "https://example.com",
            }),
        )
        const raw = formDataToObject(formData, PostSchema.RequestBodyFieldKinds)
        const result = PostSchema.RequestBodySchema.safeParse(raw)
        expect(result.success).toBe(true)
    })

    it("画像付き投稿分岐(images + imagesMeta)を受理する", () => {
        const formData = new FormData()
        formData.append("images", new Blob(["a"], { type: "image/png" }))
        formData.set("imagesMeta", JSON.stringify([{ width: 1, height: 1 }]))
        const raw = formDataToObject(formData, PostSchema.RequestBodyFieldKinds)
        const result = PostSchema.RequestBodySchema.safeParse(raw)
        expect(result.success).toBe(true)
    })

    it("どの分岐も満たさない場合は拒否する(空)", () => {
        const formData = new FormData()
        const raw = formDataToObject(formData, PostSchema.RequestBodyFieldKinds)
        const result = PostSchema.RequestBodySchema.safeParse(raw)
        expect(result.success).toBe(false)
    })

    it("facets(link/mention/tag)付きのテキスト投稿を受理する", () => {
        const formData = new FormData()
        formData.set("text", "foo bar #baz")
        formData.set(
            "facets",
            JSON.stringify([
                {
                    index: { byteStart: 0, byteEnd: 3 },
                    features: [
                        {
                            $type: "app.bsky.richtext.facet#link",
                            uri: "https://example.com",
                        },
                    ],
                },
                {
                    index: { byteStart: 4, byteEnd: 7 },
                    features: [
                        {
                            $type: "app.bsky.richtext.facet#mention",
                            did: "did:plc:examplefake000000000",
                        },
                    ],
                },
                {
                    index: { byteStart: 8, byteEnd: 12 },
                    features: [
                        { $type: "app.bsky.richtext.facet#tag", tag: "baz" },
                    ],
                },
            ]),
        )
        const raw = formDataToObject(formData, PostSchema.RequestBodyFieldKinds)
        const result = PostSchema.RequestBodySchema.safeParse(raw)
        expect(result.success).toBe(true)
    })

    it("facetオブジェクト自体に$type(app.bsky.richtext.facet)を含む形も受理する(RichText.detectFacets()の実際の出力形)", () => {
        // `@atproto/api`のRichText.detectFacets()は、facetオブジェクトのトップレベルに
        // lexicon通り$type: "app.bsky.richtext.facet"を付与する。これを未知キーとして
        // 拒否してしまう回帰を防ぐためのテスト。
        const formData = new FormData()
        formData.set("text", "foo #baz")
        formData.set(
            "facets",
            JSON.stringify([
                {
                    $type: "app.bsky.richtext.facet",
                    index: { byteStart: 0, byteEnd: 3 },
                    features: [
                        {
                            $type: "app.bsky.richtext.facet#link",
                            uri: "https://example.com",
                        },
                    ],
                },
                {
                    $type: "app.bsky.richtext.facet",
                    index: { byteStart: 4, byteEnd: 8 },
                    features: [
                        { $type: "app.bsky.richtext.facet#tag", tag: "baz" },
                    ],
                },
            ]),
        )
        const raw = formDataToObject(formData, PostSchema.RequestBodyFieldKinds)
        const result = PostSchema.RequestBodySchema.safeParse(raw)
        expect(result.success).toBe(true)
    })

    it("features内の$typeが未知の値のfacetsは拒否する", () => {
        const formData = new FormData()
        formData.set("text", "hello")
        formData.set(
            "facets",
            JSON.stringify([
                {
                    index: { byteStart: 0, byteEnd: 5 },
                    features: [{ $type: "app.bsky.richtext.facet#bold" }],
                },
            ]),
        )
        const raw = formDataToObject(formData, PostSchema.RequestBodyFieldKinds)
        const result = PostSchema.RequestBodySchema.safeParse(raw)
        expect(result.success).toBe(false)
    })
})
