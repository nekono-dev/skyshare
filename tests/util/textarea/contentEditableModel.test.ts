import { describe, expect, it } from "vitest"

import {
    partsToPlainText,
    resolvePartOffset,
    type TextPart,
} from "@/util/textarea/contentEditableModel"

describe("partsToPlainText", () => {
    it("空配列は空文字列", () => {
        expect(partsToPlainText([])).toBe("")
    })

    it("テキストpartをそのまま連結する", () => {
        const parts: TextPart[] = [
            { type: "text", value: "abc" },
            { type: "text", value: "def" },
        ]
        expect(partsToPlainText(parts)).toBe("abcdef")
    })

    it("brを改行として連結する", () => {
        const parts: TextPart[] = [
            { type: "text", value: "abc" },
            { type: "br" },
            { type: "text", value: "def" },
        ]
        expect(partsToPlainText(parts)).toBe("abc\ndef")
    })

    it("連続するbrはそれぞれ1つの改行になる", () => {
        const parts: TextPart[] = [
            { type: "text", value: "abc" },
            { type: "br" },
            { type: "br" },
            { type: "text", value: "def" },
        ]
        expect(partsToPlainText(parts)).toBe("abc\n\ndef")
    })
})

describe("resolvePartOffset", () => {
    it("partsが空なら常に先頭を返す", () => {
        expect(resolvePartOffset([], 5)).toEqual({
            partIndex: 0,
            offsetInPart: 0,
        })
    })

    it("先頭partの内部インデックスを解決する", () => {
        const parts: TextPart[] = [
            { type: "text", value: "abc" },
            { type: "text", value: "def" },
        ]
        expect(resolvePartOffset(parts, 1)).toEqual({
            partIndex: 0,
            offsetInPart: 1,
        })
    })

    it("part境界ちょうどのインデックスは直前partの末尾を返す", () => {
        const parts: TextPart[] = [
            { type: "text", value: "abc" },
            { type: "text", value: "def" },
        ]
        expect(resolvePartOffset(parts, 3)).toEqual({
            partIndex: 0,
            offsetInPart: 3,
        })
    })

    it("2つ目以降のpartの内部インデックスを解決する", () => {
        const parts: TextPart[] = [
            { type: "text", value: "abc" },
            { type: "text", value: "def" },
        ]
        expect(resolvePartOffset(parts, 5)).toEqual({
            partIndex: 1,
            offsetInPart: 2,
        })
    })

    it("brちょうどのインデックスはbr自身の末尾を返す（境界はbr要素直後の位置に対応する）", () => {
        const parts: TextPart[] = [
            { type: "text", value: "ab" },
            { type: "br" },
            { type: "text", value: "cd" },
        ]
        expect(resolvePartOffset(parts, 3)).toEqual({
            partIndex: 1,
            offsetInPart: 1,
        })
    })

    it("brの次のpart内部のインデックスを解決する", () => {
        const parts: TextPart[] = [
            { type: "text", value: "ab" },
            { type: "br" },
            { type: "text", value: "cd" },
        ]
        expect(resolvePartOffset(parts, 4)).toEqual({
            partIndex: 2,
            offsetInPart: 1,
        })
    })

    it("末尾を超えるインデックスは最後のpartの末尾にクランプする", () => {
        const parts: TextPart[] = [{ type: "text", value: "abc" }]
        expect(resolvePartOffset(parts, 100)).toEqual({
            partIndex: 0,
            offsetInPart: 3,
        })
    })

    it("負のインデックスは0にクランプする", () => {
        const parts: TextPart[] = [{ type: "text", value: "abc" }]
        expect(resolvePartOffset(parts, -1)).toEqual({
            partIndex: 0,
            offsetInPart: 0,
        })
    })
})
