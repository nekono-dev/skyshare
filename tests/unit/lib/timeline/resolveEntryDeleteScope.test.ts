/**
 * Determines whether an entry’s source post can be deleted safely.
 */
import { beforeEach, describe, expect, it, vi } from "vitest"

const getPostThread = vi.hoisted(() => vi.fn())
vi.mock("@/lib/atproto/publicAgent", () => ({
    publicAtpAgent: { app: { bsky: { feed: { getPostThread } } } },
}))

import { resolveEntryDeleteScope } from "@/lib/timeline/resolveEntryDeleteScope"
import { TEST_DID } from "../../../fixtures/identities"

const ROOT_URI = `at://${TEST_DID}/app.bsky.feed.post/3rootfixture`

const post = (rkey: string, replyTo?: string) => ({
    uri: `at://${TEST_DID}/app.bsky.feed.post/${rkey}`,
    cid: `bafy${rkey}`,
    author: { did: TEST_DID, handle: "alice.test", displayName: "Alice" },
    record: {
        $type: "app.bsky.feed.post",
        text: "t",
        createdAt: "2026-10-01T00:00:00.000Z",
        ...(replyTo
            ? {
                  reply: {
                      root: { uri: replyTo, cid: "c" },
                      parent: { uri: replyTo, cid: "c" },
                  },
              }
            : {}),
    },
    indexedAt: "2026-10-01T00:00:00.000Z",
})

describe("resolveEntryDeleteScope", () => {
    beforeEach(() => {
        getPostThread.mockReset()
        vi.spyOn(console, "error").mockImplementation(() => {})
    })

    it("reports unknown for a source URI that is not an AT-URI, without calling the network", async () => {
        expect(await resolveEntryDeleteScope("https://not-an-at-uri")).toEqual({
            kind: "unknown",
        })
        expect(getPostThread).not.toHaveBeenCalled()
    })

    it("reports legacy when the source is a reply (an entry created by the old implementation)", async () => {
        getPostThread.mockResolvedValue({
            data: {
                thread: {
                    $type: "app.bsky.feed.defs#threadViewPost",
                    post: post("3rootfixture", "at://x/y/parent"),
                    replies: [],
                },
            },
        })
        expect(await resolveEntryDeleteScope(ROOT_URI)).toEqual({
            kind: "legacy",
        })
    })

    it("reports deletable with the owner posts of the chain when the source is a root", async () => {
        getPostThread.mockResolvedValue({
            data: {
                thread: {
                    $type: "app.bsky.feed.defs#threadViewPost",
                    post: post("3rootfixture"),
                    replies: [],
                },
            },
        })
        const scope = await resolveEntryDeleteScope(ROOT_URI)
        expect(scope.kind).toBe("deletable")
        if (scope.kind === "deletable")
            expect(scope.posts.map(p => p.uri)).toEqual([ROOT_URI])
    })

    it("reports unknown when the thread cannot be read as a thread view", async () => {
        getPostThread.mockResolvedValue({
            data: {
                thread: {
                    $type: "app.bsky.feed.defs#notFoundPost",
                    uri: ROOT_URI,
                    notFound: true,
                },
            },
        })
        expect(await resolveEntryDeleteScope(ROOT_URI)).toEqual({
            kind: "unknown",
        })
    })

    it("reports unknown when reading the thread fails, so the list never guesses", async () => {
        getPostThread.mockRejectedValue(new Error("network down"))
        expect(await resolveEntryDeleteScope(ROOT_URI)).toEqual({
            kind: "unknown",
        })
    })
})
