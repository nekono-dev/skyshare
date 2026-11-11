/**
 * Selects the post that supplies an entry visual or carries the entry.
 */
import { describe, expect, it } from "vitest"
import {
    findEntryCarrier,
    resolveEntryVisualSourcePost,
} from "@/lib/timeline/entryCandidate"
import type { ThreadGroup, TimelinePost } from "@/lib/timeline/posts"

const IMAGE = {
    url: "https://cdn.test/image.jpg",
    alt: "",
    cid: "bafyimage",
}

const VIDEO = {
    cid: "bafyvideo",
    playlistUrl: "https://cdn.test/video.m3u8",
    thumbnailUrl: "https://cdn.test/video.jpg",
    alt: "",
}

const ENTRY = {
    uri: "at://did:plc:test/app.bsky.feed.post/entry",
    cid: "bafyentry",
    createdAt: "2026-10-01T00:00:00.000Z",
    sourceUri: "at://did:plc:test/app.bsky.feed.post/root",
    sourceCid: "bafyroot",
}

const post = (
    rkey: string,
    options: {
        images?: (typeof IMAGE)[]
        video?: typeof VIDEO
        entry?: typeof ENTRY
    } = {},
): TimelinePost => ({
    uri: `at://did:plc:test/app.bsky.feed.post/${rkey}`,
    cid: `bafy${rkey}`,
    url: `https://bsky.app/profile/alice.test/post/${rkey}`,
    indexedAt: "2026-10-01T00:00:00.000Z",
    author: { did: "did:plc:test", handle: "alice.test" },
    text: rkey,
    images: options.images ?? [],
    video: options.video,
    skyshareEntry: options.entry,
})

const group = (
    rootPost: TimelinePost,
    replies: TimelinePost[] = [],
): ThreadGroup => ({ rootPost, replies })

describe("resolveEntryVisualSourcePost selects a visual source post", () => {
    it("returns null for a standalone post, even when it has an image", () => {
        const g = group(post("root", { images: [IMAGE] }))
        expect(resolveEntryVisualSourcePost(g)).toBeNull()
    })

    it("returns the root when it has an image", () => {
        const root = post("root", { images: [IMAGE] })
        const g = group(root, [post("reply", { images: [IMAGE] })])
        expect(resolveEntryVisualSourcePost(g)).toBe(root)
    })

    it("returns the root when it has a video", () => {
        const root = post("root", { video: VIDEO })
        const g = group(root, [post("reply")])
        expect(resolveEntryVisualSourcePost(g)).toBe(root)
    })

    it("returns the oldest reply with media when the root has none", () => {
        const first = post("reply1", { images: [IMAGE] })
        const second = post("reply2", { images: [IMAGE] })
        const g = group(post("root"), [post("reply0"), first, second])
        expect(resolveEntryVisualSourcePost(g)).toBe(first)
    })

    it("returns null when no post in the thread has media", () => {
        const g = group(post("root"), [post("reply1"), post("reply2")])
        expect(resolveEntryVisualSourcePost(g)).toBeNull()
    })
})

describe("findEntryCarrier selects the post linked to an entry", () => {
    it("returns null for a standalone post, even when it has an entry", () => {
        const g = group(post("root", { entry: ENTRY }))
        expect(findEntryCarrier(g)).toBeNull()
    })

    it("returns the root when it has an entry", () => {
        const root = post("root", { entry: ENTRY })
        const g = group(root, [post("reply", { entry: ENTRY })])
        expect(findEntryCarrier(g)).toBe(root)
    })

    it("returns the reply when only it has an entry", () => {
        const reply = post("reply", { entry: ENTRY })
        const g = group(post("root"), [post("reply0"), reply])
        expect(findEntryCarrier(g)).toBe(reply)
    })

    it("returns null when no post in the group has an entry", () => {
        const g = group(post("root"), [post("reply")])
        expect(findEntryCarrier(g)).toBeNull()
    })
})
