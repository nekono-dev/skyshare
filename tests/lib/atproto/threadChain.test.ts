import { describe, expect, it } from "vitest"

import { extractOwnedLinearReplyChain } from "@/lib/atproto/threadChain"

const ownerDid = "did:plc:owner"
const otherDid = "did:plc:other"

/** テスト用の最小限のPostView。 */
const makePost = (uri: string, authorDid: string) => ({
    uri,
    cid: `cid-${uri}`,
    author: { did: authorDid },
    record: {},
    indexedAt: "2024-01-01T00:00:00.000Z",
})

/** テスト用の最小限のThreadViewPostノード。 */
const makeNode = (uri: string, authorDid: string, replies: any[] = []) => ({
    $type: "app.bsky.feed.defs#threadViewPost",
    post: makePost(uri, authorDid),
    replies,
})

describe("extractOwnedLinearReplyChain", () => {
    it("後続投稿が無い場合はsource自身のみを返す", () => {
        const root = makeNode("at://root", ownerDid)
        const result = extractOwnedLinearReplyChain(root as any, ownerDid, 100)
        expect(result.map(p => p.uri)).toEqual(["at://root"])
    })

    it("自分自身の投稿のみを直線的に辿って時系列順に抽出する", () => {
        const third = makeNode("at://third", ownerDid)
        const second = makeNode("at://second", ownerDid, [third])
        const root = makeNode("at://root", ownerDid, [second])

        const result = extractOwnedLinearReplyChain(root as any, ownerDid, 100)
        expect(result.map(p => p.uri)).toEqual([
            "at://root",
            "at://second",
            "at://third",
        ])
    })

    it("第三者の返信は除外する", () => {
        const otherReply = makeNode("at://other-reply", otherDid)
        const root = makeNode("at://root", ownerDid, [otherReply])

        const result = extractOwnedLinearReplyChain(root as any, ownerDid, 100)
        expect(result.map(p => p.uri)).toEqual(["at://root"])
    })

    it("第三者の返信で分岐した先(仮に所有者自身の投稿でも)は除外する", () => {
        const ownedButBranched = makeNode("at://branched", ownerDid)
        const otherReply = makeNode("at://other-reply", otherDid, [
            ownedButBranched,
        ])
        const root = makeNode("at://root", ownerDid, [otherReply])

        const result = extractOwnedLinearReplyChain(root as any, ownerDid, 100)
        expect(result.map(p => p.uri)).toEqual(["at://root"])
    })

    it("NotFoundPost/BlockedPostのようなthreadViewPostでないノードは無視する", () => {
        const notFound = {
            $type: "app.bsky.feed.defs#notFoundPost",
            uri: "at://gone",
        }
        const second = makeNode("at://second", ownerDid)
        const root = makeNode("at://root", ownerDid, [notFound, second])

        const result = extractOwnedLinearReplyChain(root as any, ownerDid, 100)
        expect(result.map(p => p.uri)).toEqual(["at://root", "at://second"])
    })

    it("maxCountに達したら打ち切る", () => {
        const third = makeNode("at://third", ownerDid)
        const second = makeNode("at://second", ownerDid, [third])
        const root = makeNode("at://root", ownerDid, [second])

        const result = extractOwnedLinearReplyChain(root as any, ownerDid, 2)
        expect(result.map(p => p.uri)).toEqual(["at://root", "at://second"])
    })
})
