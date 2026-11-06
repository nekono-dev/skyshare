// スレッドグループの entry 判定（事後 entry の Visual 取得元・entry の運び手）の規則
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

describe("resolveEntryVisualSourcePost（事後 entry の Visual 取得元）", () => {
    it("単独投稿は null（画像があっても対象にしない）", () => {
        const g = group(post("root", { images: [IMAGE] }))
        expect(resolveEntryVisualSourcePost(g)).toBeNull()
    })

    it("ルートが画像を持てばルート自身を返す", () => {
        const root = post("root", { images: [IMAGE] })
        const g = group(root, [post("reply", { images: [IMAGE] })])
        expect(resolveEntryVisualSourcePost(g)).toBe(root)
    })

    it("ルートが動画を持てばルート自身を返す（動画も素材になる）", () => {
        const root = post("root", { video: VIDEO })
        const g = group(root, [post("reply")])
        expect(resolveEntryVisualSourcePost(g)).toBe(root)
    })

    it("ルートに素材が無ければ、古い順で最初に素材を持つ返信を返す", () => {
        const first = post("reply1", { images: [IMAGE] })
        const second = post("reply2", { images: [IMAGE] })
        const g = group(post("root"), [post("reply0"), first, second])
        expect(resolveEntryVisualSourcePost(g)).toBe(first)
    })

    it("ルートも返信も素材を持たなければ null", () => {
        const g = group(post("root"), [post("reply1"), post("reply2")])
        expect(resolveEntryVisualSourcePost(g)).toBeNull()
    })
})

describe("findEntryCarrier（entry が紐づく投稿）", () => {
    it("単独投稿は、entry があっても null", () => {
        const g = group(post("root", { entry: ENTRY }))
        expect(findEntryCarrier(g)).toBeNull()
    })

    it("ルートに entry があればルート自身を返す", () => {
        const root = post("root", { entry: ENTRY })
        const g = group(root, [post("reply", { entry: ENTRY })])
        expect(findEntryCarrier(g)).toBe(root)
    })

    it("ルートに無く返信に entry があれば、その返信を返す", () => {
        const reply = post("reply", { entry: ENTRY })
        const g = group(post("root"), [post("reply0"), reply])
        expect(findEntryCarrier(g)).toBe(reply)
    })

    it("グループのどこにも entry が無ければ null", () => {
        const g = group(post("root"), [post("reply")])
        expect(findEntryCarrier(g)).toBeNull()
    })
})
