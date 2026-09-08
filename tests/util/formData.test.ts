import { describe, expect, it } from "vitest"

import {
    formDataIndexedArrayToObjects,
    formDataToObject,
} from "@/util/formData"

describe("formDataIndexedArrayToObjects", () => {
    it("インデックス付きフィールドから複数件のオブジェクト配列を復元する", () => {
        const formData = new FormData()
        formData.set("posts[0][text]", JSON.stringify("hello"))
        formData.set("posts[1][text]", JSON.stringify("world"))
        const result = formDataIndexedArrayToObjects(formData, "posts", {
            text: "json",
        })
        expect(result).toEqual([{ text: "hello" }, { text: "world" }])
    })

    it("該当フィールドが1つも無い場合は空配列を返す", () => {
        const formData = new FormData()
        const result = formDataIndexedArrayToObjects(formData, "posts", {
            text: "json",
        })
        expect(result).toEqual([])
    })

    it("インデックスが飛んでいる場合、欠けたインデックスは空オブジェクトになる", () => {
        const formData = new FormData()
        formData.set("posts[0][text]", JSON.stringify("hello"))
        formData.set("posts[2][text]", JSON.stringify("world"))
        const result = formDataIndexedArrayToObjects(formData, "posts", {
            text: "json",
        })
        expect(result).toEqual([{ text: "hello" }, {}, { text: "world" }])
    })

    it("files種別のBlob配列や、単一のfile種別も1件分ごとに正しくデコードする", () => {
        const formData = new FormData()
        formData.append("posts[0][images]", new Blob(["a"]))
        formData.append("posts[0][images]", new Blob(["b"]))
        formData.set("posts[0][ogImage]", new Blob(["c"]))
        const result = formDataIndexedArrayToObjects(formData, "posts", {
            images: "files",
            ogImage: "file",
        })
        expect(result).toHaveLength(1)
        expect(result[0].images).toHaveLength(2)
        expect(result[0].ogImage).toBeInstanceOf(Blob)
    })

    it("他のトップレベルフィールドや別の配列名は無視する", () => {
        const formData = new FormData()
        formData.set("uri", "at://example")
        formData.set("posts[0][text]", JSON.stringify("hello"))
        formData.set("other[0][text]", JSON.stringify("ignored"))
        const result = formDataIndexedArrayToObjects(formData, "posts", {
            text: "json",
        })
        expect(result).toEqual([{ text: "hello" }])
    })
})

describe("formDataToObject", () => {
    it("textは単一の文字列としてデコードする", () => {
        const formData = new FormData()
        formData.set("text", "hello")
        expect(formDataToObject(formData, { text: "text" })).toEqual({
            text: "hello",
        })
    })

    it("textsは同名フィールドを配列としてデコードする", () => {
        const formData = new FormData()
        formData.append("langs", "ja")
        formData.append("langs", "en")
        expect(formDataToObject(formData, { langs: "texts" })).toEqual({
            langs: ["ja", "en"],
        })
    })

    it("fileは単一のBlobとしてデコードする", () => {
        const formData = new FormData()
        const blob = new Blob(["x"], { type: "image/png" })
        formData.set("ogImage", blob)
        const result = formDataToObject(formData, { ogImage: "file" })
        expect(result.ogImage).toBeInstanceOf(Blob)
        expect((result.ogImage as Blob).type).toBe("image/png")
    })

    it("filesは同名フィールドをBlob配列としてデコードする", () => {
        const formData = new FormData()
        formData.append("images", new Blob(["a"]))
        formData.append("images", new Blob(["b"]))
        const result = formDataToObject(formData, { images: "files" })
        expect(result.images).toHaveLength(2)
        expect(result.images as Blob[]).toSatisfy((arr: unknown[]) =>
            arr.every(v => v instanceof Blob),
        )
    })

    it("jsonはJSON文字列をパースしてデコードする", () => {
        const formData = new FormData()
        formData.set("imagesMeta", JSON.stringify([{ width: 1, height: 1 }]))
        expect(formDataToObject(formData, { imagesMeta: "json" })).toEqual({
            imagesMeta: [{ width: 1, height: 1 }],
        })
    })

    it("jsonのパースに失敗した場合は生の値を残す", () => {
        const formData = new FormData()
        formData.set("imagesMeta", "not-json")
        expect(formDataToObject(formData, { imagesMeta: "json" })).toEqual({
            imagesMeta: "not-json",
        })
    })

    it("フィールドが存在しない場合はキー自体を含めない", () => {
        const formData = new FormData()
        expect(formDataToObject(formData, { text: "text" })).toEqual({})
    })

    describe("itemsフィールド", () => {
        it("インデックス付きフィールドから複数件のプレーンオブジェクト配列へデコードする", () => {
            const formData = new FormData()
            formData.set("posts[0][text]", JSON.stringify("1件目"))
            formData.set("posts[1][text]", JSON.stringify("2件目"))
            const result = formDataToObject(formData, {
                posts: { kind: "items", itemFieldKinds: { text: "json" } },
            })
            expect(result).toEqual({
                posts: [{ text: "1件目" }, { text: "2件目" }],
            })
        })

        it("該当フィールドが1つも無い場合はキー自体を含めない", () => {
            const formData = new FormData()
            const result = formDataToObject(formData, {
                posts: { kind: "items", itemFieldKinds: { text: "json" } },
            })
            expect(result).toEqual({})
        })

        it("画像付きセグメントとテキストのみセグメントが混在しても各要素のjson種別フィールドは1件のJSON文字列としてデコードされる", () => {
            const formData = new FormData()
            formData.set("posts[0][text]", JSON.stringify("画像あり"))
            formData.append("posts[0][images]", new Blob(["a"]))
            formData.set(
                "posts[0][imagesMeta]",
                JSON.stringify([{ width: 1, height: 1 }]),
            )
            formData.set("posts[1][text]", JSON.stringify("テキストのみ"))
            const result = formDataToObject(formData, {
                posts: {
                    kind: "items",
                    itemFieldKinds: {
                        text: "json",
                        images: "files",
                        imagesMeta: "json",
                    },
                },
            })
            const posts = result.posts as Record<string, unknown>[]
            expect(posts).toHaveLength(2)
            expect(posts[0].text).toBe("画像あり")
            expect(posts[0].images).toHaveLength(1)
            expect(posts[0].imagesMeta).toEqual([{ width: 1, height: 1 }])
            expect(posts[1].text).toBe("テキストのみ")
            expect(posts[1].images).toBeUndefined()
        })
    })
})
