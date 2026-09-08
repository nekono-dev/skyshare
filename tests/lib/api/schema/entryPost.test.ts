/**
 * `src/lib/api/schema/v2/entry/post.ts` の `RequestBodySchema` のテスト。
 *
 * 責務と処理概要:
 * - トップレベルの2分岐（from-post: `{uri, ogImage}` / 新規投稿: `{posts, reply}`）が
 *   それぞれ正しく検証されることを直接確認する。
 * - `formDataToObject`（`posts`は`{kind:"items"}`種別として自動的にインデックス付き
 *   デコードされる）によるデコードと組み合わせた統合的な検証も兼ねる。
 */
import { describe, expect, it } from "vitest"

import { formDataToObject } from "@/util/formData"
import * as PostSchema from "@/lib/api/schema/v2/entry/post"

const parseFormData = (formData: FormData) => {
    const raw = formDataToObject(formData, PostSchema.RequestBodyFieldKinds)
    return PostSchema.RequestBodySchema.safeParse(raw)
}

describe("v2/entry POST RequestBodySchema", () => {
    it("from-post分岐(uri + ogImage)を受理する", () => {
        const formData = new FormData()
        formData.set("uri", "at://did:plc:abc/app.bsky.feed.post/3lxyz")
        formData.set("ogImage", new Blob(["x"], { type: "image/png" }))
        const result = parseFormData(formData)
        expect(result.success).toBe(true)
    })

    it("新規画像投稿分岐(posts[0][images] + imagesMeta + ogImage)を受理する", () => {
        const formData = new FormData()
        formData.append(
            "posts[0][images]",
            new Blob(["a"], { type: "image/png" }),
        )
        formData.set(
            "posts[0][imagesMeta]",
            JSON.stringify([{ width: 1, height: 1 }]),
        )
        formData.set(
            "posts[0][ogImage]",
            new Blob(["x"], { type: "image/png" }),
        )
        const result = parseFormData(formData)
        expect(result.success).toBe(true)
    })

    it("テキストのみの投稿分岐(posts[0][text])を受理する", () => {
        const formData = new FormData()
        formData.set("posts[0][text]", JSON.stringify("hello"))
        const result = parseFormData(formData)
        expect(result.success).toBe(true)
    })

    it("複数件のposts(スレッド)を受理する", () => {
        const formData = new FormData()
        formData.set("posts[0][text]", JSON.stringify("1件目"))
        formData.set("posts[1][text]", JSON.stringify("2件目"))
        const result = parseFormData(formData)
        expect(result.success).toBe(true)
    })

    it("どちらの分岐も満たさない場合は拒否する(uriのみ、ogImage欠落)", () => {
        const formData = new FormData()
        formData.set("uri", "at://did:plc:abc/app.bsky.feed.post/3lxyz")
        const result = parseFormData(formData)
        expect(result.success).toBe(false)
    })

    it("どちらの分岐も満たさない場合は拒否する(imagesのみ、imagesMeta欠落)", () => {
        const formData = new FormData()
        formData.append(
            "posts[0][images]",
            new Blob(["a"], { type: "image/png" }),
        )
        formData.set(
            "posts[0][ogImage]",
            new Blob(["x"], { type: "image/png" }),
        )
        const result = parseFormData(formData)
        expect(result.success).toBe(false)
    })

    it("posts未指定・uri未指定の場合は拒否する", () => {
        const formData = new FormData()
        const result = parseFormData(formData)
        expect(result.success).toBe(false)
    })

    it("画像投稿分岐でfacets付きテキストを受理する", () => {
        const formData = new FormData()
        formData.append(
            "posts[0][images]",
            new Blob(["a"], { type: "image/png" }),
        )
        formData.set(
            "posts[0][imagesMeta]",
            JSON.stringify([{ width: 1, height: 1 }]),
        )
        formData.set(
            "posts[0][ogImage]",
            new Blob(["x"], { type: "image/png" }),
        )
        formData.set("posts[0][text]", JSON.stringify("foo bar"))
        formData.set(
            "posts[0][facets]",
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
            ]),
        )
        const result = parseFormData(formData)
        expect(result.success).toBe(true)
    })

    it("facetオブジェクト自体に$type(app.bsky.richtext.facet)を含む形も受理する(RichText.detectFacets()の実際の出力形)", () => {
        // `@atproto/api`のRichText.detectFacets()は、facetオブジェクトのトップレベルに
        // lexicon通り$type: "app.bsky.richtext.facet"を付与する。これを未知キーとして
        // 拒否してしまう回帰を防ぐためのテスト。
        const formData = new FormData()
        formData.append(
            "posts[0][images]",
            new Blob(["a"], { type: "image/png" }),
        )
        formData.set(
            "posts[0][imagesMeta]",
            JSON.stringify([{ width: 1, height: 1 }]),
        )
        formData.set(
            "posts[0][ogImage]",
            new Blob(["x"], { type: "image/png" }),
        )
        formData.set("posts[0][text]", JSON.stringify("foo bar"))
        formData.set(
            "posts[0][facets]",
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
            ]),
        )
        const result = parseFormData(formData)
        expect(result.success).toBe(true)
    })

    it("createEntryフラグを受理する", () => {
        const formData = new FormData()
        formData.append(
            "posts[0][images]",
            new Blob(["a"], { type: "image/png" }),
        )
        formData.set(
            "posts[0][imagesMeta]",
            JSON.stringify([{ width: 1, height: 1 }]),
        )
        formData.set(
            "posts[0][ogImage]",
            new Blob(["x"], { type: "image/png" }),
        )
        formData.set("posts[0][createEntry]", "true")
        const result = parseFormData(formData)
        expect(result.success).toBe(true)
        if (result.success && "posts" in result.data) {
            expect(result.data.posts[0]).toMatchObject({ createEntry: true })
        }
    })

    it("トップレベルのreply(root/parent)を受理する", () => {
        const formData = new FormData()
        formData.set("posts[0][text]", JSON.stringify("hello"))
        formData.set(
            "reply",
            JSON.stringify({
                root: {
                    uri: "at://did:plc:abc/app.bsky.feed.post/3lroot",
                    cid: "bafyroot",
                },
                parent: {
                    uri: "at://did:plc:abc/app.bsky.feed.post/3lparent",
                    cid: "bafyparent",
                },
            }),
        )
        const result = parseFormData(formData)
        expect(result.success).toBe(true)
    })

    it("replyのroot/parentにuri/cid以外の未知キーがあると拒否する", () => {
        const formData = new FormData()
        formData.set("posts[0][text]", JSON.stringify("hello"))
        formData.set(
            "reply",
            JSON.stringify({
                root: {
                    uri: "at://did:plc:abc/app.bsky.feed.post/3lroot",
                    cid: "bafyroot",
                    extra: "unexpected",
                },
                parent: {
                    uri: "at://did:plc:abc/app.bsky.feed.post/3lparent",
                    cid: "bafyparent",
                },
            }),
        )
        const result = parseFormData(formData)
        expect(result.success).toBe(false)
    })
})
