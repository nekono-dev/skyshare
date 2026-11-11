/**
 * Verifies cancellation and timeout behavior for mention suggestions.
 */
import { afterEach, describe, expect, it, vi } from "vitest"

const searchActorsTypeahead = vi.hoisted(() => vi.fn())
vi.mock("@/lib/atproto/publicAgent", () => ({
    publicAtpAgent: {
        app: { bsky: { actor: { searchActorsTypeahead } } },
    },
}))

import { searchMentionSuggestions } from "@/lib/atproto/suggest"

describe("searchMentionSuggestions", () => {
    afterEach(() => vi.restoreAllMocks())

    it("aborts when the caller signal is aborted", async () => {
        const timeoutController = new AbortController()
        vi.spyOn(AbortSignal, "timeout").mockReturnValue(
            timeoutController.signal,
        )
        searchActorsTypeahead.mockImplementationOnce(
            (_params: unknown, options: { signal: AbortSignal }) =>
                new Promise((_resolve, reject) => {
                    options.signal.addEventListener("abort", () => {
                        reject(new DOMException("Aborted", "AbortError"))
                    })
                }),
        )
        const caller = new AbortController()
        const result = searchMentionSuggestions("alice", {
            signal: caller.signal,
        })
        caller.abort()
        await expect(result).rejects.toMatchObject({ name: "AbortError" })
    })

    it("keeps the timeout active when a caller signal is supplied", async () => {
        const timeoutController = new AbortController()
        vi.spyOn(AbortSignal, "timeout").mockReturnValue(
            timeoutController.signal,
        )
        searchActorsTypeahead.mockImplementationOnce(
            (_params: unknown, options: { signal: AbortSignal }) =>
                new Promise((_resolve, reject) => {
                    options.signal.addEventListener("abort", () => {
                        reject(new DOMException("Timed out", "AbortError"))
                    })
                }),
        )
        const result = searchMentionSuggestions("alice", {
            signal: new AbortController().signal,
        })
        timeoutController.abort()
        await expect(result).rejects.toMatchObject({ name: "AbortError" })
    })
})
