import { describe, expect, it } from "vitest"

import { isObjectRecord } from "@/util/object"

describe("isObjectRecord", () => {
    it("[browser-utils/AC-1] プレーンオブジェクトは true", () => {
        expect(isObjectRecord({ a: 1 })).toBe(true)
        expect(isObjectRecord({})).toBe(true)
    })

    it("[browser-utils/AC-2] null は false", () => {
        expect(isObjectRecord(null)).toBe(false)
    })

    it("[browser-utils/AC-3] 配列は false", () => {
        expect(isObjectRecord([1, 2, 3])).toBe(false)
    })

    it("プリミティブ値は false", () => {
        expect(isObjectRecord("string")).toBe(false)
        expect(isObjectRecord(123)).toBe(false)
        expect(isObjectRecord(undefined)).toBe(false)
        expect(isObjectRecord(true)).toBe(false)
    })
})
