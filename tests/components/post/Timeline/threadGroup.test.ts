import { describe, expect, it } from "vitest"
import { groupIntoThreads } from "@/components/post/Timeline/threadGroup"
import type { TimelinePost } from "@/lib/entry/posts"

const author = {
    did: "did:plc:abc",
    handle: "alice.bsky.social",
}

/** テスト用の最小限のTimelinePostを組み立てる。 */
const makePost = (
    rkey: string,
    indexedAt: string,
    replyParentRkey?: string,
): TimelinePost => ({
    uri: `at://did:plc:abc/app.bsky.feed.post/${rkey}`,
    cid: `cid-${rkey}`,
    url: `https://bsky.app/profile/alice.bsky.social/post/${rkey}`,
    indexedAt,
    author,
    text: rkey,
    images: [],
    replyParentUri: replyParentRkey
        ? `at://did:plc:abc/app.bsky.feed.post/${replyParentRkey}`
        : undefined,
})

describe("groupIntoThreads", () => {
    it("単独投稿のみの場合、各投稿がreplies:[]の単独グループになる", () => {
        const items = [makePost("b", "2026-01-02"), makePost("a", "2026-01-01")]
        const groups = groupIntoThreads(items)

        expect(groups).toHaveLength(2)
        expect(groups[0]).toEqual({
            id: items[0].uri,
            rootPost: items[0],
            replies: [],
        })
        expect(groups[1]).toEqual({
            id: items[1].uri,
            rootPost: items[1],
            replies: [],
        })
    })

    it("連続するスレッド(3件)を1つのグループにまとめ、時系列順(古い→新しい)で並べる", () => {
        // items は indexedAt 降順（新しい順）。
        const tail = makePost("tail", "2026-01-03", "mid")
        const mid = makePost("mid", "2026-01-02", "root")
        const root = makePost("root", "2026-01-01")
        const items = [tail, mid, root]

        const groups = groupIntoThreads(items)

        expect(groups).toHaveLength(1)
        expect(groups[0].id).toBe(root.uri)
        expect(groups[0].rootPost).toEqual(root)
        expect(groups[0].replies).toEqual([mid, tail])
    })

    it("スレッドと無関係な単独投稿が混在する場合、それぞれ独立したグループになる", () => {
        const other = makePost("other", "2026-01-05")
        const tail = makePost("tail", "2026-01-03", "root")
        const root = makePost("root", "2026-01-01")
        const items = [other, tail, root]

        const groups = groupIntoThreads(items)

        expect(groups).toHaveLength(2)
        const otherGroup = groups.find(g => g.id === other.uri)
        const threadGroup = groups.find(g => g.id === root.uri)
        expect(otherGroup?.replies).toEqual([])
        expect(threadGroup?.replies).toEqual([tail])
    })

    it("ページング境界外（一覧に存在しない投稿）への参照は連結せず、その投稿自身がrootになる", () => {
        // "mid" は replyParentUri で存在しない投稿(境界外)を指す。
        const mid = makePost("mid", "2026-01-02", "outside-of-page")
        const items = [mid]

        const groups = groupIntoThreads(items)

        expect(groups).toHaveLength(1)
        expect(groups[0]).toEqual({ id: mid.uri, rootPost: mid, replies: [] })
    })

    it("間に他人の投稿が挟まりreplyParentUriが一覧内に存在しない場合も連結しない", () => {
        // "b" は "a" への返信だが、"a" は一覧に含まれない（他人の投稿等）。
        const b = makePost("b", "2026-01-02", "a")
        const c = makePost("c", "2026-01-01")
        const items = [b, c]

        const groups = groupIntoThreads(items)

        expect(groups).toHaveLength(2)
        expect(groups.find(g => g.id === b.uri)?.replies).toEqual([])
        expect(groups.find(g => g.id === c.uri)?.replies).toEqual([])
    })
})
