import { describe, expect, it } from "vitest"

import {
    buildThreadViewFromPosts,
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

    it("[entry-detail/AC-5] 第三者の返信は除外する", () => {
        const otherReply = makeNode("at://other-reply", otherDid)
        const root = makeNode("at://root", ownerDid, [otherReply])

        const result = extractOwnedLinearReplyChain(root as any, ownerDid, 100)
        expect(result.map(p => p.uri)).toEqual(["at://root"])
    })

    it("[entry-detail/AC-5] 第三者の返信で分岐した先(仮に所有者自身の投稿でも)は除外する", () => {
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

describe("buildThreadViewFromPosts", () => {
    /** 一覧の投稿（返信数と親の参照を持つ）。 */
    const makeFeedPost = (
        id: string,
        parent: string | undefined,
        replyCount: number | undefined,
        createdAt?: string,
    ) => ({
        ...makePost(`at://${id}`, ownerDid, createdAt),
        record: {
            ...(createdAt !== undefined ? { createdAt } : {}),
            ...(parent
                ? {
                      reply: {
                          parent: { uri: `at://${parent}` },
                          root: { uri: "at://root" },
                      },
                  }
                : {}),
        },
        replyCount,
    })
    const toMap = (...posts: any[]) =>
        new Map(posts.map(post => [post.uri as string, post]))

    it("[timeline-api/AC-14] 返信数がすべて一覧の子の件数と一致すれば、個別取得した場合と同じ系統を返す", () => {
        const posts = toMap(
            makeFeedPost("root", undefined, 1),
            makeFeedPost("mid", "root", 1),
            makeFeedPost("tail", "mid", 0),
        )

        const view = buildThreadViewFromPosts("at://root", posts as any)

        expect(view).toBeDefined()
        const chain = extractOwnedLinearReplyChain(view!, ownerDid, 100)
        expect(chain.map(p => p.uri)).toEqual([
            "at://root",
            "at://mid",
            "at://tail",
        ])
    })

    it("[timeline-api/AC-14] 分岐でも全候補が一覧にあれば、親に最も近い日時の系統を選ぶ", () => {
        const posts = toMap(
            makeFeedPost("root", undefined, 2, "2026-01-01T00:00:00Z"),
            makeFeedPost("far", "root", 0, "2026-01-05T00:00:00Z"),
            makeFeedPost("near", "root", 0, "2026-01-01T00:00:10Z"),
        )

        const view = buildThreadViewFromPosts("at://root", posts as any)

        const chain = extractOwnedLinearReplyChain(view!, ownerDid, 100)
        expect(chain.map(p => p.uri)).toEqual(["at://root", "at://near"])
    })

    it("[timeline-api/AC-15] 返信数が一覧の子の件数より多ければ（他人の返信や欠落）確定できない", () => {
        const posts = toMap(
            makeFeedPost("root", undefined, 2),
            makeFeedPost("mid", "root", 0),
        )

        expect(buildThreadViewFromPosts("at://root", posts as any)).toBe(
            undefined,
        )
    })

    it("[timeline-api/AC-15] 中間の投稿が一覧から欠けていれば確定できない", () => {
        const posts = toMap(
            makeFeedPost("root", undefined, 1),
            makeFeedPost("tail", "mid", 0),
        )

        expect(buildThreadViewFromPosts("at://root", posts as any)).toBe(
            undefined,
        )
    })

    it("[timeline-api/AC-15] 返信数が一覧の子の件数より少なければ確定できない", () => {
        const posts = toMap(
            makeFeedPost("root", undefined, 0),
            makeFeedPost("mid", "root", 0),
        )

        expect(buildThreadViewFromPosts("at://root", posts as any)).toBe(
            undefined,
        )
    })

    it("[timeline-api/AC-15] 返信数が数値でない投稿があれば確定できない", () => {
        const posts = toMap(
            makeFeedPost("root", undefined, undefined),
            makeFeedPost("mid", "root", 0),
        )

        expect(buildThreadViewFromPosts("at://root", posts as any)).toBe(
            undefined,
        )
    })

    it("[timeline-api/AC-15] 起点が一覧に無ければ確定できない", () => {
        const posts = toMap(makeFeedPost("mid", "root", 0))

        expect(buildThreadViewFromPosts("at://root", posts as any)).toBe(
            undefined,
        )
    })

    it("親子の参照が循環していても無限に辿らない", () => {
        const posts = toMap(
            makeFeedPost("root", "tail", 1),
            makeFeedPost("tail", "root", 1),
        )

        expect(buildThreadViewFromPosts("at://root", posts as any)).toBe(
            undefined,
        )
    })
})
