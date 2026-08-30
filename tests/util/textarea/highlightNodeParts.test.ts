import { describe, expect, it } from "vitest"

import {
    computeHighlightNodeParts,
    diffNodeParts,
    partsEqual,
    type NodePart,
} from "@/util/textarea/highlightNodeParts"

describe("computeHighlightNodeParts", () => {
    it("空文字列は空配列", () => {
        expect(computeHighlightNodeParts("")).toEqual([])
    })

    it("プレーンテキストのみなら1つのtext part", () => {
        expect(computeHighlightNodeParts("hello")).toEqual([
            { type: "text", value: "hello", highlighted: false },
        ])
    })

    it("改行を含むプレーンテキストはtext/br/textに分割される", () => {
        expect(computeHighlightNodeParts("ab\ncd")).toEqual([
            { type: "text", value: "ab", highlighted: false },
            { type: "br" },
            { type: "text", value: "cd", highlighted: false },
        ])
    })

    it("末尾が改行の場合、末尾にanchor partが付加される", () => {
        expect(computeHighlightNodeParts("abc\n")).toEqual([
            { type: "text", value: "abc", highlighted: false },
            { type: "br" },
            { type: "anchor" },
        ])
    })

    it("末尾が改行以外の場合、anchor partは付加されない", () => {
        expect(computeHighlightNodeParts("abc\ndef")).toEqual([
            { type: "text", value: "abc", highlighted: false },
            { type: "br" },
            { type: "text", value: "def", highlighted: false },
        ])
    })

    it("連続する改行は連続するbr partになる", () => {
        expect(computeHighlightNodeParts("a\n\nb")).toEqual([
            { type: "text", value: "a", highlighted: false },
            { type: "br" },
            { type: "br" },
            { type: "text", value: "b", highlighted: false },
        ])
    })

    it("ハッシュタグ部分はhighlighted:trueのtext partになる", () => {
        expect(computeHighlightNodeParts("見て #猫 かわいい")).toEqual([
            { type: "text", value: "見て ", highlighted: false },
            { type: "text", value: "#猫", highlighted: true },
            { type: "text", value: " かわいい", highlighted: false },
        ])
    })
})

describe("partsEqual", () => {
    it("型が違えばfalse", () => {
        expect(partsEqual({ type: "br" }, { type: "anchor" })).toBe(false)
    })

    it("br同士は常にtrue", () => {
        expect(partsEqual({ type: "br" }, { type: "br" })).toBe(true)
    })

    it("anchor同士は常にtrue", () => {
        expect(partsEqual({ type: "anchor" }, { type: "anchor" })).toBe(true)
    })

    it("text同士はvalueとhighlightedが両方一致すればtrue", () => {
        const a: NodePart = { type: "text", value: "abc", highlighted: true }
        const b: NodePart = { type: "text", value: "abc", highlighted: true }
        expect(partsEqual(a, b)).toBe(true)
    })

    it("textはvalueが違えばfalse", () => {
        const a: NodePart = { type: "text", value: "abc", highlighted: false }
        const b: NodePart = { type: "text", value: "abd", highlighted: false }
        expect(partsEqual(a, b)).toBe(false)
    })

    it("textはhighlightedが違えばfalse", () => {
        const a: NodePart = { type: "text", value: "abc", highlighted: false }
        const b: NodePart = { type: "text", value: "abc", highlighted: true }
        expect(partsEqual(a, b)).toBe(false)
    })
})

describe("diffNodeParts", () => {
    it("完全一致なら全て接頭辞、接尾辞は0", () => {
        const parts: NodePart[] = [
            { type: "text", value: "abc", highlighted: false },
            { type: "br" },
        ]
        expect(diffNodeParts(parts, [...parts])).toEqual({
            prefixLen: 2,
            suffixLen: 0,
        })
    })

    it("完全に異なるなら接頭辞・接尾辞ともに0", () => {
        const oldParts: NodePart[] = [
            { type: "text", value: "abc", highlighted: false },
        ]
        const newParts: NodePart[] = [
            { type: "text", value: "xyz", highlighted: true },
        ]
        expect(diffNodeParts(oldParts, newParts)).toEqual({
            prefixLen: 0,
            suffixLen: 0,
        })
    })

    it("末尾に1つ追加しただけなら、全体が接頭辞として扱われる", () => {
        const oldParts: NodePart[] = [
            { type: "text", value: "ab", highlighted: false },
        ]
        const newParts: NodePart[] = [
            { type: "text", value: "ab", highlighted: false },
            { type: "text", value: "c", highlighted: false },
        ]
        expect(diffNodeParts(oldParts, newParts)).toEqual({
            prefixLen: 1,
            suffixLen: 0,
        })
    })

    it("先頭に1つ追加しただけなら、全体が接尾辞として扱われる", () => {
        const oldParts: NodePart[] = [
            { type: "text", value: "bc", highlighted: false },
        ]
        const newParts: NodePart[] = [
            { type: "text", value: "a", highlighted: false },
            { type: "text", value: "bc", highlighted: false },
        ]
        expect(diffNodeParts(oldParts, newParts)).toEqual({
            prefixLen: 0,
            suffixLen: 1,
        })
    })

    it("中間だけが異なる場合、前後の共通区間を正しく検出する", () => {
        const oldParts: NodePart[] = [
            { type: "text", value: "head", highlighted: false },
            { type: "text", value: "OLD", highlighted: true },
            { type: "text", value: "tail", highlighted: false },
        ]
        const newParts: NodePart[] = [
            { type: "text", value: "head", highlighted: false },
            { type: "text", value: "NEW", highlighted: true },
            { type: "text", value: "tail", highlighted: false },
        ]
        expect(diffNodeParts(oldParts, newParts)).toEqual({
            prefixLen: 1,
            suffixLen: 1,
        })
    })

    it("共通要素が1つしかない場合、接頭辞と接尾辞で二重カウントしない", () => {
        const oldParts: NodePart[] = [
            { type: "text", value: "same", highlighted: false },
        ]
        const newParts: NodePart[] = [
            { type: "text", value: "same", highlighted: false },
        ]
        // 完全一致ケースだが、prefixLenを先に最大まで伸ばした後、
        // suffixLenの探索がmaxCommon-prefixLenで頭打ちになり0のままであることを確認する。
        expect(diffNodeParts(oldParts, newParts)).toEqual({
            prefixLen: 1,
            suffixLen: 0,
        })
    })

    it("空配列同士は0/0", () => {
        expect(diffNodeParts([], [])).toEqual({ prefixLen: 0, suffixLen: 0 })
    })
})
