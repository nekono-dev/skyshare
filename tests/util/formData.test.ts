import { describe, expect, it } from "vitest"

import { dropEmptyStringField, formDataToObject } from "@/util/formData"

describe("dropEmptyStringField", () => {
    it("空文字フィールドは削除する", () => {
        const formData = new FormData()
        formData.set("text", "")
        dropEmptyStringField(formData, "text")
        expect(formData.has("text")).toBe(false)
    })

    it("空白のみのフィールドも削除する", () => {
        const formData = new FormData()
        formData.set("text", "   ")
        dropEmptyStringField(formData, "text")
        expect(formData.has("text")).toBe(false)
    })

    it("非空文字は残す", () => {
        const formData = new FormData()
        formData.set("text", "hello")
        dropEmptyStringField(formData, "text")
        expect(formData.get("text")).toBe("hello")
    })

    it("フィールド自体が無い場合は無変更", () => {
        const formData = new FormData()
        formData.set("other", "value")
        dropEmptyStringField(formData, "text")
        expect(formData.has("text")).toBe(false)
        expect(formData.get("other")).toBe("value")
    })

    it("同一インスタンスを返す", () => {
        const formData = new FormData()
        expect(dropEmptyStringField(formData, "text")).toBe(formData)
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
})
