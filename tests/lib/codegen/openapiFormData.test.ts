import { describe, expect, it } from "vitest"

import {
    customFormData,
    ITEMS_FIELD_NAMES,
} from "@/lib/codegen/openapiFormData"
import * as EntryPostSchema from "@/lib/api/schema/v2/entry/post"

describe("customFormData", () => {
    it("textフィールドは常にJSON.stringifyしてから積む", () => {
        const formData = customFormData({ text: "hello\nworld" })
        expect(formData.get("text")).toBe(JSON.stringify("hello\nworld"))
    })

    it("Blobはそのまま積む", () => {
        const blob = new Blob(["x"], { type: "image/png" })
        const formData = customFormData({ ogImage: blob })
        const appended = formData.get("ogImage")
        expect(appended).toBeInstanceOf(Blob)
        expect((appended as Blob).type).toBe("image/png")
        expect((appended as Blob).size).toBe(blob.size)
    })

    it("Blob配列は複数フィールドへ展開する", () => {
        const blobs = [new Blob(["a"]), new Blob(["b"])]
        const formData = customFormData({ images: blobs })
        const appended = formData.getAll("images")
        expect(appended).toHaveLength(2)
        expect(appended.every(value => value instanceof Blob)).toBe(true)
    })

    it("プリミティブ配列は複数フィールドへ展開する", () => {
        const formData = customFormData({ langs: ["ja", "en"] })
        expect(formData.getAll("langs")).toEqual(["ja", "en"])
    })

    it("プレーンオブジェクトはJSON文字列化する", () => {
        const formData = customFormData({
            ogMeta: {
                title: "t",
                description: "d",
                url: "https://example.com",
            },
        })
        expect(formData.get("ogMeta")).toBe(
            JSON.stringify({
                title: "t",
                description: "d",
                url: "https://example.com",
            }),
        )
    })

    it("プレーンオブジェクトの配列(posts)はインデックス付きフィールド名へ展開する", () => {
        const blob = new Blob(["img"], { type: "image/png" })
        const formData = customFormData({
            posts: [
                { text: "1件目", images: [blob] },
                { text: "2件目\n改行あり" },
            ],
        })

        expect(formData.get("posts[0][text]")).toBe(JSON.stringify("1件目"))
        expect(formData.get("posts[0][images]")).toBeInstanceOf(Blob)
        expect(formData.get("posts[1][text]")).toBe(
            JSON.stringify("2件目\n改行あり"),
        )
        expect(formData.has("posts")).toBe(false)
    })

    it("posts配下のimagesMeta・facets(Blobを含まないプレーンオブジェクトの配列)は展開されずJSON文字列のままになる（回帰テスト）", () => {
        const blob = new Blob(["img"], { type: "image/png" })
        const facets = [
            {
                index: { byteStart: 0, byteEnd: 3 },
                features: [
                    {
                        $type: "app.bsky.richtext.facet#link",
                        uri: "https://example.com",
                    },
                ],
            },
        ]
        const imagesMeta = [{ width: 1, height: 1, alt: "" }]
        const formData = customFormData({
            posts: [
                {
                    text: "hello",
                    images: [blob],
                    imagesMeta,
                    facets,
                },
            ],
        })

        // 展開されたposts[0][images]は存在する
        expect(formData.get("posts[0][images]")).toBeInstanceOf(Blob)
        // しかしimagesMeta/facetsは展開されず、1個のJSON文字列フィールドのまま
        expect(formData.get("posts[0][imagesMeta]")).toBe(
            JSON.stringify(imagesMeta),
        )
        expect(formData.get("posts[0][facets]")).toBe(JSON.stringify(facets))
        expect(formData.has("posts[0][imagesMeta][0][width]")).toBe(false)
        expect(formData.has("posts[0][facets][0][index][byteStart]")).toBe(
            false,
        )
    })

    it("postsがBlobを含まない(テキストのみのスレッド)場合でも、内容に関わらず常にインデックス展開される", () => {
        const formData = customFormData({
            posts: [{ text: "1件目" }, { text: "2件目" }],
        })

        expect(formData.get("posts[0][text]")).toBe(JSON.stringify("1件目"))
        expect(formData.get("posts[1][text]")).toBe(JSON.stringify("2件目"))
        expect(formData.has("posts")).toBe(false)
    })

    it("undefined/nullの値は積まない", () => {
        const formData = customFormData({ text: "hello", ogImage: undefined })
        expect(formData.has("ogImage")).toBe(false)
    })

    it("クロスチェック: サーバ側スキーマがitems種別として宣言しているフィールドと、クライアント側ITEMS_FIELD_NAMESが一致することを確認する（この2つは型システムを跨いで自動同期されないため、ズレを検出する）", () => {
        const itemsFieldsInSchema = Object.entries(
            EntryPostSchema.RequestBodyFieldKinds,
        )
            .filter(
                ([, kind]) => typeof kind === "object" && kind.kind === "items",
            )
            .map(([field]) => field)

        expect(itemsFieldsInSchema).toEqual(["posts"])
        for (const field of itemsFieldsInSchema) {
            expect(ITEMS_FIELD_NAMES.has(field)).toBe(true)
        }
        expect(ITEMS_FIELD_NAMES.size).toBe(itemsFieldsInSchema.length)
    })
})
