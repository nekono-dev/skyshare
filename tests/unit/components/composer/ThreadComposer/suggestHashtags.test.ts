// ハッシュタグ候補の順序・出所・重複の除去・件数の上限を、分割の前の値で固定する（要件 2.1・2.3）。
// 履歴の読み出しとトレンドの取得は、外部の通信と保存を避けるため置き換える。
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

describe("getHashtagCandidates（候補の順序と出所）", () => {
    it("履歴を先に並べ、トレンドは履歴に無いものだけを後ろに足す", async () => {
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

    it("履歴との重複は、大文字小文字を無視して除く", async () => {
        history.readHashtagHistory.mockReturnValue([{ tag: "SkyShare" }])
        trend.getTrendingTagSuggestions.mockResolvedValue([{ tag: "skyshare" }])

        const result = await getHashtagCandidates({ prefix: "sky" })

        expect(result).toEqual([{ tag: "SkyShare", source: "history" }])
    })

    it("プレフィックスに一致しない候補は、履歴とトレンドの両方から除く", async () => {
        history.readHashtagHistory.mockReturnValue([{ tag: "apple" }])
        trend.getTrendingTagSuggestions.mockResolvedValue([{ tag: "banana" }])

        expect(await getHashtagCandidates({ prefix: "ba" })).toEqual([
            { tag: "banana", source: "trending" },
        ])
    })

    it("候補は最大 5 件までにする", async () => {
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
