// 区切りの追加・削除と先頭の区切りの扱い、投稿可否の判定を、分割の前の値で固定する（要件 1.2・1.3）。
import { describe, expect, it } from "vitest"
import { MAX_THREAD_POST_COUNT } from "@/lib/atproto/post"
import {
    addSegment,
    areAllSegmentsPostable,
    canRemoveSegment,
    createEmptySegment,
    removeSegment,
    type SegmentState,
} from "@/components/composer/ThreadComposer/rules/segments"

const withText = (text: string): SegmentState => ({
    ...createEmptySegment("ja"),
    text,
})

describe("先頭の区切りの扱い", () => {
    it("先頭の区切りは削除できず、2 件目以降は削除できる", () => {
        expect(canRemoveSegment(0)).toBe(false)
        expect(canRemoveSegment(1)).toBe(true)
        expect(canRemoveSegment(2)).toBe(true)
    })

    it("先頭を削除しようとしたとき、区切りは変わらない", () => {
        const segments = [withText("a"), withText("b")]
        expect(removeSegment(segments, 0)).toBe(segments)
    })

    it("2 件目を削除すると、残りの区切りが順序どおりに残る", () => {
        const segments = [withText("a"), withText("b"), withText("c")]
        expect(removeSegment(segments, 1).map(s => s.text)).toEqual(["a", "c"])
    })
})

describe("区切りの追加", () => {
    it("末尾に空の区切りを足し、言語を引き継ぐ", () => {
        const added = addSegment([withText("a")], "en")
        expect(added).toHaveLength(2)
        expect(added[1]?.text).toBe("")
        expect(added[1]?.languageCode).toBe("en")
    })

    it("上限に達しているときは、区切りを足さない", () => {
        const full = Array.from({ length: MAX_THREAD_POST_COUNT }, (_, i) =>
            withText(String(i)),
        )
        expect(addSegment(full, "ja")).toBe(full)
    })
})

describe("投稿可否の判定（全区切り）", () => {
    it("区切りが無いときは投稿できない", () => {
        expect(areAllSegmentsPostable([])).toBe(false)
    })

    it("本文のある区切りが 1 件あれば投稿できる", () => {
        expect(areAllSegmentsPostable([withText("x")])).toBe(true)
    })

    it("空白だけの区切りは投稿できない", () => {
        expect(areAllSegmentsPostable([withText("   ")])).toBe(false)
    })

    it("1 件でも空の区切りがあれば、全体として投稿できない", () => {
        expect(areAllSegmentsPostable([withText("a"), withText("")])).toBe(
            false,
        )
    })
})
