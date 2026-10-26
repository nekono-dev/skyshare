import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/lib/atproto/publicAgent", () => ({
    publicAtpAgent: {
        app: {
            bsky: {
                actor: { searchActorsTypeahead: vi.fn() },
                unspecced: { getTrendingTopics: vi.fn() },
            },
        },
    },
}))

import { publicAtpAgent } from "@/lib/atproto/publicAgent"
import {
    getTrendingTagSuggestions,
    searchMentionSuggestions,
} from "@/lib/atproto/suggest"

const search = vi.mocked(publicAtpAgent.app.bsky.actor.searchActorsTypeahead)
const trending = vi.mocked(publicAtpAgent.app.bsky.unspecced.getTrendingTopics)

describe("searchMentionSuggestions", () => {
    beforeEach(() => {
        search.mockReset()
    })

    it("[post-suggest/2.1] 検索の件数の上限5件を指定して取得し、候補へ整形する", async () => {
        search.mockResolvedValue({
            data: {
                actors: [
                    {
                        did: "did:plc:a",
                        handle: "a.test",
                        displayName: "A",
                        avatar: "https://a",
                    },
                ],
            },
        } as any)
        const result = await searchMentionSuggestions("a")
        expect(search.mock.calls[0][0]).toEqual({ q: "a", limit: 5 })
        expect(result).toEqual([
            {
                did: "did:plc:a",
                handle: "a.test",
                displayName: "A",
                avatarUrl: "https://a",
            },
        ])
    })

    it("[post-suggest/2.2] 入力が空のとき、検索を行わずに空の候補が返る", async () => {
        expect(await searchMentionSuggestions("")).toEqual([])
        expect(search).not.toHaveBeenCalled()
    })

    it("[post-suggest/2.3] 検索が失敗したとき、空の候補が返る", async () => {
        vi.spyOn(console, "warn").mockImplementation(() => {})
        search.mockRejectedValue(new Error("network"))
        expect(await searchMentionSuggestions("a")).toEqual([])
    })

    it("[post-suggest/2.6] 呼び出しに、5秒で打ち切る指定が渡される", async () => {
        search.mockResolvedValue({ data: { actors: [] } } as any)
        const timeoutSpy = vi.spyOn(AbortSignal, "timeout")
        await searchMentionSuggestions("a")
        expect(timeoutSpy).toHaveBeenCalledWith(5000)
        timeoutSpy.mockRestore()
    })

    it("[post-suggest/2.6] signalを渡した場合も、5秒のタイムアウトで打ち切られる", async () => {
        const timeoutController = new AbortController()
        const timeoutSpy = vi
            .spyOn(AbortSignal, "timeout")
            .mockReturnValue(timeoutController.signal)
        try {
            search.mockResolvedValue({ data: { actors: [] } } as any)
            const caller = new AbortController()
            await searchMentionSuggestions("a", { signal: caller.signal })
            expect(timeoutSpy).toHaveBeenCalledWith(5000)
            const passed = (search.mock.calls[0][1] as any)
                .signal as AbortSignal
            expect(passed).not.toBe(caller.signal)
            expect(passed.aborted).toBe(false)
            timeoutController.abort()
            expect(passed.aborted).toBe(true)
            expect(caller.signal.aborted).toBe(false)
        } finally {
            timeoutSpy.mockRestore()
        }
    })
})

describe("getTrendingTagSuggestions", () => {
    beforeEach(() => {
        trending.mockReset()
        vi.useFakeTimers()
    })

    it("[post-suggest/2.5] 5分以内に2回取得すると、トレンドの取得は1回になる", async () => {
        vi.setSystemTime(new Date("2030-01-01T00:00:00Z"))
        trending.mockResolvedValue({
            data: { topics: [{ topic: "alpha" }], suggested: [] },
        } as any)
        const first = await getTrendingTagSuggestions()
        vi.setSystemTime(new Date("2030-01-01T00:04:00Z"))
        const second = await getTrendingTagSuggestions()
        expect(second).toEqual(first)
        expect(trending).toHaveBeenCalledTimes(1)
    })

    it("[post-suggest/2.5] 空白を含む文字列は、トレンドの候補から除かれる", async () => {
        vi.setSystemTime(new Date("2030-02-01T00:00:00Z"))
        trending.mockResolvedValue({
            data: {
                topics: [{ topic: "#good" }, { topic: "has space" }],
                suggested: [],
            },
        } as any)
        const tags = await getTrendingTagSuggestions()
        expect(tags).toEqual([{ tag: "good" }])
    })
})
