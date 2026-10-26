import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/lib/settings/hashtagHistorySettings", () => ({
    readHashtagHistory: vi.fn(),
}))
vi.mock("@/lib/atproto/suggest", () => ({
    getTrendingTagSuggestions: vi.fn(),
}))

import { readHashtagHistory } from "@/lib/settings/hashtagHistorySettings"
import { getTrendingTagSuggestions } from "@/lib/atproto/suggest"
import { getHashtagCandidates } from "@/components/post/ThreadComposer/suggestHashtags"

const history = vi.mocked(readHashtagHistory)
const trending = vi.mocked(getTrendingTagSuggestions)

describe("getHashtagCandidates", () => {
    beforeEach(() => {
        history.mockReset()
        trending.mockReset()
    })

    it("[post-suggest/2.4] 履歴を先に並べ、履歴と重なるトレンドを除く", async () => {
        history.mockReturnValue([
            { tag: "Alpha", lastUsedAt: 2 },
            { tag: "beta", lastUsedAt: 1 },
        ])
        trending.mockResolvedValue([{ tag: "alpha" }, { tag: "alps" }])
        const result = await getHashtagCandidates({
            prefix: "al",
            accountDid: "did:plc:a",
        })
        expect(result).toEqual([
            { tag: "Alpha", source: "history" },
            { tag: "alps", source: "trending" },
        ])
    })

    it("[post-suggest/2.4] 候補は5件までに切り詰められる", async () => {
        history.mockReturnValue([])
        trending.mockResolvedValue(
            Array.from({ length: 8 }, (_, i) => ({ tag: `tag${i}` })),
        )
        const result = await getHashtagCandidates({ prefix: "tag" })
        expect(result).toHaveLength(5)
    })
})
