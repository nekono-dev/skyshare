/**
 * `src/lib/api/schema/v2/entry/post.ts` の `RequestBodySchema` のテスト。
 *
 * 責務と処理概要:
 * - multipart+anyOfの力技(`.superRefine`によるOR判定)をネイティブな`z.union`に
 *   置き換えたため、2つの分岐(from-post/新規画像投稿)それぞれが引き続き
 *   正しく検証されることを直接確認する。
 * - `formDataToObject`によるデコードと組み合わせた統合的な検証も兼ねる。
 */
import { describe, expect, it } from "vitest"

import { formDataToObject } from "@/util/formData"
import * as PostSchema from "@/lib/api/schema/v2/entry/post"

describe("v2/entry POST RequestBodySchema", () => {
    it("from-post分岐(uri + ogImage)を受理する", () => {
        const formData = new FormData()
        formData.set("uri", "at://did:plc:abc/app.bsky.feed.post/3lxyz")
        formData.set("ogImage", new Blob(["x"], { type: "image/png" }))
        const raw = formDataToObject(formData, PostSchema.RequestBodyFieldKinds)
        const result = PostSchema.RequestBodySchema.safeParse(raw)
        expect(result.success).toBe(true)
    })

    it("新規画像投稿分岐(images + imagesMeta + ogImage)を受理する", () => {
        const formData = new FormData()
        formData.append("images", new Blob(["a"], { type: "image/png" }))
        formData.set("imagesMeta", JSON.stringify([{ width: 1, height: 1 }]))
        formData.set("ogImage", new Blob(["x"], { type: "image/png" }))
        const raw = formDataToObject(formData, PostSchema.RequestBodyFieldKinds)
        const result = PostSchema.RequestBodySchema.safeParse(raw)
        expect(result.success).toBe(true)
    })

    it("どちらの分岐も満たさない場合は拒否する(uriのみ、ogImage欠落)", () => {
        const formData = new FormData()
        formData.set("uri", "at://did:plc:abc/app.bsky.feed.post/3lxyz")
        const raw = formDataToObject(formData, PostSchema.RequestBodyFieldKinds)
        const result = PostSchema.RequestBodySchema.safeParse(raw)
        expect(result.success).toBe(false)
    })

    it("どちらの分岐も満たさない場合は拒否する(imagesのみ、imagesMeta欠落)", () => {
        const formData = new FormData()
        formData.append("images", new Blob(["a"], { type: "image/png" }))
        formData.set("ogImage", new Blob(["x"], { type: "image/png" }))
        const raw = formDataToObject(formData, PostSchema.RequestBodyFieldKinds)
        const result = PostSchema.RequestBodySchema.safeParse(raw)
        expect(result.success).toBe(false)
    })
})
