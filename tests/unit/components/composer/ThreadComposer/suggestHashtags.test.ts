/**
 * Locks down hashtag candidate ordering, sources, deduplication, and limits.
 * History and trending lookups are replaced to avoid external reads and writes.
 */
import { beforeEach, describe, expect, it, vi } from "vitest"

const history = vi.hoisted(() => ({
    readHashtagHistory: vi.fn(),
}))
const trend = vi.hoisted(() => ({
    getTrendingTagSuggestions: vi.fn(),
}))

vi.mock("@/lib/settings/hashtagHistorySettings", () => history)
vi.mock("@/lib/atproto/suggest", () => trend)

import { getHashtagCandidates } from "@/components/composer/ThreadComposer/rules/suggestHashtags"

beforeEach(() => {
    history.readHashtagHistory.mockReset()
    trend.getTrendingTagSuggestions.mockReset()
})

describe("getHashtagCandidates ordering and sources", () => {
    it("puts history first and appends only new trending tags", async () => {
        history.readHashtagHistory.mockReturnValue([
            { tag: "skyshare" },
            { tag: "bluesky" },
        ])
        trend.getTrendingTagSuggestions.mockResolvedValue([
            { tag: "bluesky" },
            { tag: "blueskyjp" },
        ])

        const result = await getHashtagCandidates({
            prefix: "blue",
            accountDid: "did:example:1",
        })

        expect(result).toEqual([
            { tag: "bluesky", source: "history" },
            { tag: "blueskyjp", source: "trending" },
        ])
    })

    it("drops trending tags that duplicate a history tag regardless of case", async () => {
        history.readHashtagHistory.mockReturnValue([{ tag: "SkyShare" }])
        trend.getTrendingTagSuggestions.mockResolvedValue([{ tag: "skyshare" }])

        const result = await getHashtagCandidates({ prefix: "sky" })

        expect(result).toEqual([{ tag: "SkyShare", source: "history" }])
    })

    it("removes candidates that do not match the prefix from both sources", async () => {
        history.readHashtagHistory.mockReturnValue([{ tag: "apple" }])
        trend.getTrendingTagSuggestions.mockResolvedValue([{ tag: "banana" }])

        expect(await getHashtagCandidates({ prefix: "ba" })).toEqual([
            { tag: "banana", source: "trending" },
        ])
    })

    it("limits candidates to five", async () => {
        history.readHashtagHistory.mockReturnValue(
            Array.from({ length: 4 }, (_, i) => ({ tag: `h${i}` })),
        )
        trend.getTrendingTagSuggestions.mockResolvedValue(
            Array.from({ length: 4 }, (_, i) => ({ tag: `t${i}` })),
        )

        const result = await getHashtagCandidates({ prefix: "" })

        expect(result).toHaveLength(5)
        expect(result[4]).toEqual({ tag: "t0", source: "trending" })
    })
})
