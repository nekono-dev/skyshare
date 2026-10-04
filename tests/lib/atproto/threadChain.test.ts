import { describe, expect, it } from "vitest"

import {
    extractOwnedLinearReplyChain,
    extractReplyRootUri,
    extractRepoDidFromAtUri,
    isThreadRootPost,
} from "@/lib/atproto/threadChain"

const ownerDid = "did:plc:owner"
const otherDid = "did:plc:other"

/** テスト用の最小限のPostView。`createdAt`は分岐時の時刻近接tie-breakの検証に使う。 */
const makePost = (uri: string, authorDid: string, createdAt?: string) => ({
    uri,
    cid: `cid-${uri}`,
    author: { did: authorDid },
    record: createdAt !== undefined ? { createdAt } : {},
    indexedAt: "2024-01-01T00:00:00.000Z",
})

/** テスト用の最小限のThreadViewPostノード。 */
const makeNode = (
    uri: string,
    authorDid: string,
    replies: any[] = [],
    createdAt?: string,
) => ({
    $type: "app.bsky.feed.defs#threadViewPost",
    post: makePost(uri, authorDid, createdAt),
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

    it("起点(source自身)がownerDidと不一致の場合は空配列を返す", () => {
        const root = makeNode("at://root", otherDid)
        const result = extractOwnedLinearReplyChain(root as any, ownerDid, 100)
        expect(result).toEqual([])
    })

    it("分岐時、親の投稿日時に最も近い候補を採用する", () => {
        const branchFar = makeNode(
            "at://branch-far",
            ownerDid,
            [],
            "2024-01-01T00:05:00.000Z",
        )
        const branchNear = makeNode(
            "at://branch-near",
            ownerDid,
            [],
            "2024-01-01T00:00:05.000Z",
        )
        const root = makeNode(
            "at://root",
            ownerDid,
            [branchFar, branchNear],
            "2024-01-01T00:00:00.000Z",
        )

        const result = extractOwnedLinearReplyChain(root as any, ownerDid, 100)
        expect(result.map(p => p.uri)).toEqual([
            "at://root",
            "at://branch-near",
        ])
    })

    it("分岐時、絶対差が同値の候補はreplies内の出現順で先勝ちする", () => {
        const branchA = makeNode(
            "at://branch-a",
            ownerDid,
            [],
            "2024-01-01T00:00:05.000Z",
        )
        const branchB = makeNode(
            "at://branch-b",
            ownerDid,
            [],
            "2024-01-01T00:00:05.000Z",
        )
        const root = makeNode(
            "at://root",
            ownerDid,
            [branchA, branchB],
            "2024-01-01T00:00:00.000Z",
        )

        const result = extractOwnedLinearReplyChain(root as any, ownerDid, 100)
        expect(result.map(p => p.uri)).toEqual(["at://root", "at://branch-a"])
    })

    it("分岐時、createdAtが欠損した候補より有効な候補を優先する", () => {
        const missingCreatedAt = makeNode("at://branch-missing", ownerDid, [])
        const validCreatedAt = makeNode(
            "at://branch-valid",
            ownerDid,
            [],
            "2024-06-01T00:00:00.000Z",
        )
        const root = makeNode(
            "at://root",
            ownerDid,
            [missingCreatedAt, validCreatedAt],
            "2024-01-01T00:00:00.000Z",
        )

        const result = extractOwnedLinearReplyChain(root as any, ownerDid, 100)
        expect(result.map(p => p.uri)).toEqual([
            "at://root",
            "at://branch-valid",
        ])
    })

    it("分岐が無い場合(候補1件)は、投稿日時が大きく離れていてもそのまま採用する", () => {
        // 既存の古い投稿に事後で新規スレッドを継ぎ足すケースを想定
        const followUp = makeNode(
            "at://follow-up",
            ownerDid,
            [],
            "2024-06-01T00:00:00.000Z",
        )
        const root = makeNode(
            "at://root",
            ownerDid,
            [followUp],
            "2024-01-01T00:00:00.000Z",
        )

        const result = extractOwnedLinearReplyChain(root as any, ownerDid, 100)
        expect(result.map(p => p.uri)).toEqual(["at://root", "at://follow-up"])
    })
})

describe("extractReplyRootUri", () => {
    it("record.reply.rootが存在する場合、そのuriを返す", () => {
        const post = {
            uri: "at://tail",
            record: {
                reply: {
                    parent: { uri: "at://mid" },
                    root: { uri: "at://root" },
                },
            },
        }
        expect(extractReplyRootUri(post as any)).toBe("at://root")
    })

    it("record.replyが無い場合はundefinedを返す", () => {
        const post = { uri: "at://root", record: {} }
        expect(extractReplyRootUri(post as any)).toBeUndefined()
    })

    it("recordが無い場合はundefinedを返す", () => {
        const post = { uri: "at://root" }
        expect(extractReplyRootUri(post as any)).toBeUndefined()
    })
})

describe("extractRepoDidFromAtUri", () => {
    it("AT URIのauthority部分（DID）を返す", () => {
        expect(
            extractRepoDidFromAtUri("at://did:plc:abc/app.bsky.feed.post/1"),
        ).toBe("did:plc:abc")
    })

    it("collection/rkeyを持たないAT URIでもauthorityを返す", () => {
        expect(extractRepoDidFromAtUri("at://did:plc:abc")).toBe("did:plc:abc")
    })

    it("at://形式でない文字列はundefinedを返す", () => {
        expect(extractRepoDidFromAtUri("https://example.com/x")).toBeUndefined()
        expect(extractRepoDidFromAtUri("")).toBeUndefined()
    })
})

describe("isThreadRootPost", () => {
    const ref = { uri: "at://did:plc:owner/app.bsky.feed.post/3lp", cid: "c" }
    const post = (record: unknown) =>
        ({
            ...makePost("at://x/app.bsky.feed.post/1", ownerDid),
            record,
        }) as any

    it("record.replyを持たない投稿は起点", () => {
        expect(
            isThreadRootPost(post({ $type: "app.bsky.feed.post", text: "a" })),
        ).toBe(true)
    })

    it("record.replyを持つ投稿は起点でない", () => {
        expect(
            isThreadRootPost(
                post({
                    $type: "app.bsky.feed.post",
                    reply: { root: ref, parent: ref },
                }),
            ),
        ).toBe(false)
    })

    it("recordが投稿レコードでない場合は起点として扱う", () => {
        expect(isThreadRootPost(post({}))).toBe(true)
    })
})
