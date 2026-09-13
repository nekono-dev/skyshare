import { describe, expect, it } from "vitest"
import {
    addSegment,
    canRemoveSegment,
    createEmptySegment,
    draftPostsToSegments,
    removeSegment,
    segmentsToDraftPosts,
    type SegmentState,
} from "@/components/post/ThreadComposer/segments"
import { MAX_THREAD_POST_COUNT } from "@/lib/atproto/post"

describe("createEmptySegment", () => {
    it("空のセグメントを作る", () => {
        const segment = createEmptySegment("ja")
        expect(segment.text).toBe("")
        expect(segment.languageCode).toBe("ja")
        expect(segment.selfLabel).toBeUndefined()
        expect(segment.imageEntry).toBeNull()
        expect(segment.ogpResult).toBeNull()
    })

    it("呼び出しごとに一意なidを発行する", () => {
        const a = createEmptySegment("ja")
        const b = createEmptySegment("ja")
        expect(a.id).not.toBe(b.id)
    })
})

describe("addSegment", () => {
    it("末尾にセグメントを1件追加する", () => {
        const segments = [createEmptySegment("ja")]
        const next = addSegment(segments, "en")
        expect(next).toHaveLength(2)
        expect(next[1].languageCode).toBe("en")
    })

    it("MAX_THREAD_POST_COUNTに達している場合は追加しない", () => {
        const segments = Array.from({ length: MAX_THREAD_POST_COUNT }, () =>
            createEmptySegment("ja"),
        )
        const next = addSegment(segments, "ja")
        expect(next).toHaveLength(MAX_THREAD_POST_COUNT)
        expect(next).toBe(segments)
    })
})

describe("canRemoveSegment / removeSegment", () => {
    it("先頭(0件目)は削除できない", () => {
        expect(canRemoveSegment(0)).toBe(false)
        const segments = [createEmptySegment("ja"), createEmptySegment("ja")]
        const next = removeSegment(segments, 0)
        expect(next).toBe(segments)
        expect(next).toHaveLength(2)
    })

    it("2件目以降は削除できる", () => {
        expect(canRemoveSegment(1)).toBe(true)
        const first = createEmptySegment("ja")
        const second = createEmptySegment("ja")
        const third = createEmptySegment("ja")
        const next = removeSegment([first, second, third], 1)
        expect(next).toEqual([first, third])
    })
})

describe("segmentsToDraftPosts / draftPostsToSegments", () => {
    it("セグメント配列を下書きposts配列へ変換する（labelsは選択時のみ）", () => {
        const segments: SegmentState[] = [
            {
                ...createEmptySegment("ja"),
                text: "1件目",
                selfLabel: "spoiler",
            },
            { ...createEmptySegment("ja"), text: "2件目" },
        ]
        const posts = segmentsToDraftPosts(segments)
        expect(posts).toEqual([
            { text: "1件目", labels: ["spoiler"] },
            { text: "2件目", labels: undefined },
        ])
    })

    it("下書きposts配列からセグメント配列を復元する（画像等は空で復元される）", () => {
        const restored = draftPostsToSegments(
            [{ text: "1件目", labels: ["spoiler"] }, { text: "2件目" }],
            "en",
        )
        expect(restored).toHaveLength(2)
        expect(restored[0].text).toBe("1件目")
        expect(restored[0].selfLabel).toBe("spoiler")
        expect(restored[0].languageCode).toBe("en")
        expect(restored[0].imageEntry).toBeNull()
        expect(restored[0].ogpResult).toBeNull()
        expect(restored[1].text).toBe("2件目")
        expect(restored[1].selfLabel).toBeUndefined()
    })

    it("往復させても本文とlabelsが保たれる", () => {
        const original = segmentsToDraftPosts([
            { ...createEmptySegment("ja"), text: "本文A" },
            { ...createEmptySegment("ja"), text: "本文B", selfLabel: "!warn" },
        ])
        const roundTripped = segmentsToDraftPosts(
            draftPostsToSegments(original, "ja"),
        )
        expect(roundTripped).toEqual(original)
    })
})
