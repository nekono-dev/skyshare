/**
 * Locks down request bodies built from text-only segments before the composer split.
 * Media loading and external network requests are excluded.
 */
import { describe, expect, it } from "vitest"
import { buildThreadRequestBody } from "@/components/composer/ThreadComposer/rules/submitThread"
import {
    createEmptySegment,
    type SegmentState,
} from "@/components/composer/ThreadComposer/rules/segments"

const textSegment = (text: string, languageCode = "ja"): SegmentState => ({
    ...createEmptySegment(languageCode),
    text,
})

describe("buildThreadRequestBody text-only segments", () => {
    it("preserves segment order and includes each post text and language", async () => {
        const built = await buildThreadRequestBody({
            segments: [textSegment("一つ目"), textSegment("two", "en")],
            manualImageAttach: false,
        })

        expect(built.ok).toBe(true)
        if (!built.ok) return
        expect(built.wantsSkyshareEntry).toBe(false)
        // 提出の本文は `posts` を持つが、API 型（CreateEntryBody）には現れないため、読み取りの型を明示する
        const { posts } = built.body as unknown as {
            posts: { text: string; langs: string[] }[]
        }
        expect(posts.map(p => p.text)).toEqual(["一つ目", "two"])
        expect(posts.map(p => p.langs)).toEqual([["ja"], ["en"]])
    })

    it("omits createEntry for text-only segments", async () => {
        const built = await buildThreadRequestBody({
            segments: [textSegment("a")],
            manualImageAttach: false,
        })

        expect(built.ok).toBe(true)
        if (!built.ok) return
        expect("createEntry" in built.body).toBe(false)
    })
})
