import { describe, expect, it } from "vitest"

import { dropEmptyStringField } from "@/util/formData"

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
