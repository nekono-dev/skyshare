/**
 * Locks down segment editing and postability before the composer split.
 */
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

describe("leading segment behavior", () => {
    it("cannot remove the leading segment but can remove later segments", () => {
        expect(canRemoveSegment(0)).toBe(false)
        expect(canRemoveSegment(1)).toBe(true)
        expect(canRemoveSegment(2)).toBe(true)
    })

    it("leaves segments unchanged when removing the leading segment", () => {
        const segments = [withText("a"), withText("b")]
        expect(removeSegment(segments, 0)).toBe(segments)
    })

    it("preserves the order of remaining segments after removal", () => {
        const segments = [withText("a"), withText("b"), withText("c")]
        expect(removeSegment(segments, 1).map(s => s.text)).toEqual(["a", "c"])
    })
})

describe("adding a segment", () => {
    it("appends an empty segment and inherits the language", () => {
        const added = addSegment([withText("a")], "en")
        expect(added).toHaveLength(2)
        expect(added[1]?.text).toBe("")
        expect(added[1]?.languageCode).toBe("en")
    })

    it("does not append a segment at the limit", () => {
        const full = Array.from({ length: MAX_THREAD_POST_COUNT }, (_, i) =>
            withText(String(i)),
        )
        expect(addSegment(full, "ja")).toBe(full)
    })
})

describe("postability across all segments", () => {
    it("cannot post with no segments", () => {
        expect(areAllSegmentsPostable([])).toBe(false)
    })

    it("can post when at least one segment has text", () => {
        expect(areAllSegmentsPostable([withText("x")])).toBe(true)
    })

    it("cannot post a segment containing only whitespace", () => {
        expect(areAllSegmentsPostable([withText("   ")])).toBe(false)
    })

    it("cannot post when any segment is empty", () => {
        expect(areAllSegmentsPostable([withText("a"), withText("")])).toBe(
            false,
        )
    })
})
