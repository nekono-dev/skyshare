import { describe, expect, it, vi } from "vitest"

import {
    DEFAULT_POST_GATE_VALUE,
    applyPostGate,
    buildPostgateRecord,
    buildThreadgateRecord,
    type PostGateValue,
} from "@/lib/atproto/gate"

const createdAt = "2026-01-01T00:00:00.000Z"
const postUri = "at://did:plc:abc/app.bsky.feed.post/3lxyz"

describe("buildThreadgateRecord", () => {
    it("everyoneの場合はnullを返す(レコードを作らない)", () => {
        const result = buildThreadgateRecord(
            postUri,
            DEFAULT_POST_GATE_VALUE,
            createdAt,
        )
        expect(result).toBeNull()
    })

    it("nobodyの場合はallow:[]を返す", () => {
        const gate: PostGateValue = {
            ...DEFAULT_POST_GATE_VALUE,
            replyAudience: "nobody",
        }
        const result = buildThreadgateRecord(postUri, gate, createdAt)
        expect(result).toEqual({
            $type: "app.bsky.feed.threadgate",
            post: postUri,
            createdAt,
            allow: [],
        })
    })

    it("customの場合、選択したフラグに応じたunion要素を積む", () => {
        const gate: PostGateValue = {
            ...DEFAULT_POST_GATE_VALUE,
            replyAudience: "custom",
            allowMentioned: true,
            allowFollower: true,
            allowFollowing: false,
            listUris: ["at://did:plc:abc/app.bsky.graph.list/1"],
        }
        const result = buildThreadgateRecord(postUri, gate, createdAt)
        expect(result).toEqual({
            $type: "app.bsky.feed.threadgate",
            post: postUri,
            createdAt,
            allow: [
                { $type: "app.bsky.feed.threadgate#mentionRule" },
                { $type: "app.bsky.feed.threadgate#followerRule" },
                {
                    $type: "app.bsky.feed.threadgate#listRule",
                    list: "at://did:plc:abc/app.bsky.graph.list/1",
                },
            ],
        })
    })

    it("customで5件を超えるリストを指定した場合、5件へclampされる", () => {
        const gate: PostGateValue = {
            ...DEFAULT_POST_GATE_VALUE,
            replyAudience: "custom",
            allowMentioned: true,
            allowFollower: true,
            allowFollowing: true,
            listUris: ["l1", "l2", "l3", "l4", "l5"],
        }
        const result = buildThreadgateRecord(postUri, gate, createdAt)
        expect((result as { allow: unknown[] }).allow).toHaveLength(5)
    })
})

describe("buildPostgateRecord", () => {
    it("allowQuote:trueの場合はnullを返す(レコードを作らない)", () => {
        const result = buildPostgateRecord(
            postUri,
            DEFAULT_POST_GATE_VALUE,
            createdAt,
        )
        expect(result).toBeNull()
    })

    it("allowQuote:falseの場合はdisableRuleを含むレコードを返す", () => {
        const gate: PostGateValue = {
            ...DEFAULT_POST_GATE_VALUE,
            allowQuote: false,
        }
        const result = buildPostgateRecord(postUri, gate, createdAt)
        expect(result).toEqual({
            $type: "app.bsky.feed.postgate",
            post: postUri,
            createdAt,
            embeddingRules: [{ $type: "app.bsky.feed.postgate#disableRule" }],
        })
    })
})

describe("applyPostGate", () => {
    const did = "did:plc:abc"
    const rkey = "3lxyz"

    it("完全デフォルト(everyone+allowQuote:true)の場合、createRecordは呼ばれない", async () => {
        const createRecord = vi.fn()
        const agent = { com: { atproto: { repo: { createRecord } } } }

        const result = await applyPostGate(
            agent,
            did,
            postUri,
            rkey,
            DEFAULT_POST_GATE_VALUE,
        )

        expect(createRecord).not.toHaveBeenCalled()
        expect(result).toEqual({
            threadgateFailed: false,
            postgateFailed: false,
        })
    })

    it("両方成功時はfailedフラグがともにfalse", async () => {
        const createRecord = vi.fn().mockResolvedValue({ uri: "at://x" })
        const agent = { com: { atproto: { repo: { createRecord } } } }
        const gate: PostGateValue = {
            ...DEFAULT_POST_GATE_VALUE,
            replyAudience: "nobody",
            allowQuote: false,
        }

        const result = await applyPostGate(agent, did, postUri, rkey, gate)

        expect(createRecord).toHaveBeenCalledTimes(2)
        expect(result).toEqual({
            threadgateFailed: false,
            postgateFailed: false,
        })
    })

    it("threadgate作成のみ失敗した場合、threadgateFailedのみtrueになる", async () => {
        const createRecord = vi
            .fn()
            .mockImplementationOnce(() =>
                Promise.reject(new Error("threadgate failed")),
            )
            .mockImplementationOnce(() => Promise.resolve({ uri: "at://x" }))
        const agent = { com: { atproto: { repo: { createRecord } } } }
        const gate: PostGateValue = {
            ...DEFAULT_POST_GATE_VALUE,
            replyAudience: "nobody",
            allowQuote: false,
        }

        const result = await applyPostGate(agent, did, postUri, rkey, gate)

        expect(result).toEqual({
            threadgateFailed: true,
            postgateFailed: false,
        })
    })
})
