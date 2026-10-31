// component 層の基盤の確認: DOM の指定がないファイルは Node 環境で動く
import { describe, expect, it } from "vitest"

describe("component harness (node)", () => {
    it("runs without a DOM by default", () => {
        expect(typeof document).toBe("undefined")
    })
})
