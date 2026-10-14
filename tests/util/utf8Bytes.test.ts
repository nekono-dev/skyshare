import { describe, expect, it } from "vitest"

import { countUtf8Bytes, truncateToUtf8Bytes } from "@/util/utf8Bytes"

describe("utf8Bytes", () => {
    it("UTF-8のバイト数を数える", () => {
        expect(countUtf8Bytes("a")).toBe(1)
        expect(countUtf8Bytes("あ")).toBe(3)
        expect(countUtf8Bytes("👨‍👩‍👧")).toBe(18)
    })

    it("上限以内ならそのまま返し、超えるなら書記素の単位で切り詰める", () => {
        expect(truncateToUtf8Bytes("あい", 6)).toBe("あい")
        expect(truncateToUtf8Bytes("あいう", 7)).toBe("あい")
        // 結合文字を途中で分断しない
        expect(truncateToUtf8Bytes("a👨‍👩‍👧", 10)).toBe("a")
    })
})
