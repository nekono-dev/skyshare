/**
 * Parses AT URIs and validates ownership and collection.
 */
import { describe, expect, it } from "vitest"
import { parseAtUri, parseOwnedAtUri } from "@/lib/atproto/atUri"

const uri = "at://did:plc:abc/app.bsky.feed.post/3lxyz"

describe("AT URI parsing", () => {
    it("parses an AT URI into repo, collection, and rkey", () => {
        expect(parseAtUri(uri)).toEqual({
            repo: "did:plc:abc",
            collection: "app.bsky.feed.post",
            rkey: "3lxyz",
        })
    })

    it("returns undefined for a string that is not an AT URI", () => {
        expect(parseAtUri("https://example.com")).toBeUndefined()
    })

    it("parses an AT URI when the repo and collection match", () => {
        expect(
            parseOwnedAtUri(uri, "app.bsky.feed.post", "did:plc:abc"),
        ).toEqual({
            repo: "did:plc:abc",
            collection: "app.bsky.feed.post",
            rkey: "3lxyz",
        })
    })

    it("returns undefined when the repo does not match", () => {
        expect(
            parseOwnedAtUri(uri, "app.bsky.feed.post", "did:plc:other"),
        ).toBeUndefined()
    })
})
