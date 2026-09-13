import { describe, expect, it } from "vitest"
import {
    findEntryCarrier,
    resolvePostCreateEntryTarget,
} from "@/components/post/ThreadCard/entryCandidate"
import type { ThreadGroup } from "@/components/post/Timeline/threadGroup"
import type { TimelinePost } from "@/lib/entry/posts"

const author = { did: "did:plc:abc", handle: "alice.bsky.social" }

const makePost = (
    rkey: string,
    overrides: Partial<TimelinePost> = {},
): TimelinePost => ({
    uri: `at://did:plc:abc/app.bsky.feed.post/${rkey}`,
    cid: `cid-${rkey}`,
    url: `https://bsky.app/profile/alice.bsky.social/post/${rkey}`,
    indexedAt: "2026-01-01T00:00:00Z",
    author,
    text: rkey,
    images: [],
    ...overrides,
})

const skyshareEntry = {
    uri: "https://skyshare.example/x",
    cid: "entrycid",
    createdAt: "2026-01-01T00:00:00Z",
    sourceUri: "at://did:plc:abc/app.bsky.feed.post/root",
    sourceCid: "cid-root",
}

const image = { url: "https://example.com/a.png", alt: "", cid: "imgcid" }

describe("resolvePostCreateEntryTarget", () => {
    it("単独投稿(replies:[])はnullを返す", () => {
        const group: ThreadGroup = {
            id: "root",
            rootPost: makePost("root", { images: [image] }),
            replies: [],
        }
        expect(resolvePostCreateEntryTarget(group)).toBeNull()
    })

    it("ルート投稿が画像を持つ場合はnullを返す", () => {
        const group: ThreadGroup = {
            id: "root",
            rootPost: makePost("root", { images: [image] }),
            replies: [makePost("mid", { images: [image] })],
        }
        expect(resolvePostCreateEntryTarget(group)).toBeNull()
    })

    it("グループ内のいずれかにentryが既にある場合はnullを返す", () => {
        const group: ThreadGroup = {
            id: "root",
            rootPost: makePost("root", { skyshareEntry }),
            replies: [makePost("mid", { images: [image] })],
        }
        expect(resolvePostCreateEntryTarget(group)).toBeNull()
    })

    it("ルート以外に画像投稿が無い場合はnullを返す", () => {
        const group: ThreadGroup = {
            id: "root",
            rootPost: makePost("root"),
            replies: [makePost("mid"), makePost("tail")],
        }
        expect(resolvePostCreateEntryTarget(group)).toBeNull()
    })

    it("ルート以外に画像投稿が複数ある場合、最も古いもの(repliesの先頭)を返す", () => {
        const mid = makePost("mid", { images: [image] })
        const tail = makePost("tail", { images: [image] })
        const group: ThreadGroup = {
            id: "root",
            rootPost: makePost("root"),
            replies: [mid, tail],
        }
        expect(resolvePostCreateEntryTarget(group)).toBe(mid)
    })
})

describe("findEntryCarrier", () => {
    it("単独投稿(replies:[])はnullを返す", () => {
        const group: ThreadGroup = {
            id: "root",
            rootPost: makePost("root", { skyshareEntry }),
            replies: [],
        }
        expect(findEntryCarrier(group)).toBeNull()
    })

    it("グループ内のどの投稿にもentryが無い場合はnullを返す", () => {
        const group: ThreadGroup = {
            id: "root",
            rootPost: makePost("root"),
            replies: [makePost("mid")],
        }
        expect(findEntryCarrier(group)).toBeNull()
    })

    it("ルート投稿にentryがある場合、ルート投稿を返す", () => {
        const root = makePost("root", { skyshareEntry })
        const group: ThreadGroup = {
            id: "root",
            rootPost: root,
            replies: [makePost("mid")],
        }
        expect(findEntryCarrier(group)).toBe(root)
    })
})
