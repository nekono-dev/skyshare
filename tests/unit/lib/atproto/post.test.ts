/**
 * Builds Bluesky post records from text and creation metadata.
 */
import { describe, expect, it } from "vitest"
import { buildBskyPostRecord } from "@/lib/atproto/post"

describe("buildBskyPostRecord", () => {
    it("builds a post record from text and creation time", () => {
        expect(
            buildBskyPostRecord({
                text: "hello",
                facets: undefined,
                langs: undefined,
                embed: undefined,
                selfLabel: undefined,
                reply: undefined,
                createdAt: "2026-01-01T00:00:00.000Z",
            }),
        ).toEqual({
            $type: "app.bsky.feed.post",
            text: "hello",
            createdAt: "2026-01-01T00:00:00.000Z",
            via: "Skyshare",
        })
    })
})
