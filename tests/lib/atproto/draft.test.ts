import { describe, expect, it } from "vitest"

import {
    buildSelfLabels,
    extractLabelValues,
    parseCreateDraftBody,
    parseDeleteDraftBody,
    parseDraft,
    parseDraftPostsInput,
    parseDraftQuery,
    parseDraftViewsResponse,
    parseUpdateDraftBody,
} from "@/lib/atproto/draft"

describe("extractLabelValues", () => {
    it("values配列からラベル値を抽出する", () => {
        expect(extractLabelValues({ values: [{ val: "sexual" }] })).toEqual([
            "sexual",
        ])
    })

    it("valuesが無い/不正な形式は undefined", () => {
        expect(extractLabelValues({})).toBeUndefined()
        expect(extractLabelValues(null)).toBeUndefined()
        expect(extractLabelValues({ values: [] })).toBeUndefined()
    })
})

describe("parseDraft", () => {
    it("posts配列全体のtext/labelsを取り出す(単一投稿)", () => {
        expect(
            parseDraft({
                posts: [
                    { text: "hello", labels: { values: [{ val: "sexual" }] } },
                ],
            }),
        ).toEqual([{ text: "hello", labels: ["sexual"] }])
    })

    it("posts配列が複数件(スレッド下書き)ならすべて取り出す", () => {
        expect(
            parseDraft({
                posts: [{ text: "スレッド1" }, { text: "スレッド2" }],
            }),
        ).toEqual([
            { text: "スレッド1", labels: undefined },
            { text: "スレッド2", labels: undefined },
        ])
    })

    it("posts配列が無い/textが無い場合は undefined", () => {
        expect(parseDraft({})).toBeUndefined()
        expect(parseDraft({ posts: [{}] })).toBeUndefined()
    })
})

describe("parseDeleteDraftBody", () => {
    it("id文字列を検証する", () => {
        expect(parseDeleteDraftBody({ id: "3ldrafttid" })).toEqual({
            id: "3ldrafttid",
        })
    })

    it("idが無い/文字列でない場合は undefined", () => {
        expect(parseDeleteDraftBody({})).toBeUndefined()
        expect(parseDeleteDraftBody({ id: 123 })).toBeUndefined()
    })
})

describe("parseDraftPostsInput / parseCreateDraftBody", () => {
    it("posts配列(単一)を検証する", () => {
        expect(parseDraftPostsInput({ posts: [{ text: "hello" }] })).toEqual([
            { text: "hello", labels: undefined },
        ])
        expect(parseCreateDraftBody({ posts: [{ text: "hello" }] })).toEqual({
            posts: [{ text: "hello", labels: undefined }],
        })
    })

    it("posts配列(複数件、スレッド下書き)を検証する", () => {
        expect(
            parseDraftPostsInput({
                posts: [{ text: "スレッド1" }, { text: "スレッド2" }],
            }),
        ).toEqual([
            { text: "スレッド1", labels: undefined },
            { text: "スレッド2", labels: undefined },
        ])
    })

    it("labelsが文字列配列であれば受理する", () => {
        expect(
            parseDraftPostsInput({
                posts: [{ text: "hello", labels: ["sexual"] }],
            }),
        ).toEqual([{ text: "hello", labels: ["sexual"] }])
    })

    it("labelsが文字列配列でなければ undefined", () => {
        expect(
            parseDraftPostsInput({
                posts: [{ text: "hello", labels: "sexual" }],
            }),
        ).toBeUndefined()
        expect(
            parseDraftPostsInput({
                posts: [{ text: "hello", labels: [1, 2] }],
            }),
        ).toBeUndefined()
    })

    it("postsが空配列/未指定/上限超過なら undefined", () => {
        expect(parseDraftPostsInput({ posts: [] })).toBeUndefined()
        expect(parseDraftPostsInput({})).toBeUndefined()
        expect(
            parseDraftPostsInput({
                posts: Array.from({ length: 101 }, () => ({ text: "x" })),
            }),
        ).toBeUndefined()
    })
})

describe("parseUpdateDraftBody", () => {
    it("id + posts を検証する", () => {
        expect(
            parseUpdateDraftBody({
                id: "3ldrafttid",
                posts: [{ text: "hello" }],
            }),
        ).toEqual({
            id: "3ldrafttid",
            posts: [{ text: "hello", labels: undefined }],
        })
    })

    it("idが無ければ undefined", () => {
        expect(
            parseUpdateDraftBody({ posts: [{ text: "hello" }] }),
        ).toBeUndefined()
    })
})

describe("buildSelfLabels", () => {
    it("ラベル値からselfLabelsオブジェクトを組み立てる", () => {
        expect(buildSelfLabels(["sexual"])).toEqual({
            $type: "com.atproto.label.defs#selfLabels",
            values: [{ val: "sexual" }],
        })
    })

    it("空/未指定は undefined", () => {
        expect(buildSelfLabels(undefined)).toBeUndefined()
        expect(buildSelfLabels([])).toBeUndefined()
    })
})

describe("parseDraftQuery", () => {
    it("limit/cursorを検証する", () => {
        const request = new Request(
            "https://example.com/v2/bsky/drafts?limit=20&cursor=abc",
        )
        expect(parseDraftQuery(request)).toEqual({ limit: 20, cursor: "abc" })
    })

    it("limitが範囲外なら undefined", () => {
        const request = new Request(
            "https://example.com/v2/bsky/drafts?limit=0",
        )
        expect(parseDraftQuery(request)).toBeUndefined()
    })

    it("クエリ無しなら空オブジェクト", () => {
        const request = new Request("https://example.com/v2/bsky/drafts")
        expect(parseDraftQuery(request)).toEqual({})
    })
})

describe("parseDraftViewsResponse", () => {
    it("正常なレスポンスを検証する(単一投稿)", () => {
        expect(
            parseDraftViewsResponse({
                cursor: "next",
                drafts: [
                    {
                        id: "3ldrafttid",
                        createdAt: "2026-01-01T00:00:00Z",
                        updatedAt: "2026-01-01T00:00:00Z",
                        draft: { posts: [{ text: "hello" }] },
                    },
                ],
            }),
        ).toEqual({
            cursor: "next",
            drafts: [
                {
                    id: "3ldrafttid",
                    posts: [{ text: "hello", labels: undefined }],
                    createdAt: "2026-01-01T00:00:00Z",
                    updatedAt: "2026-01-01T00:00:00Z",
                },
            ],
        })
    })

    it("posts複数件(スレッド下書き)も検証する", () => {
        expect(
            parseDraftViewsResponse({
                drafts: [
                    {
                        id: "3lthreaddraft",
                        createdAt: "2026-01-01T00:00:00Z",
                        updatedAt: "2026-01-01T00:00:00Z",
                        draft: {
                            posts: [
                                { text: "スレッド1" },
                                { text: "スレッド2" },
                            ],
                        },
                    },
                ],
            }),
        ).toEqual({
            cursor: undefined,
            drafts: [
                {
                    id: "3lthreaddraft",
                    posts: [
                        { text: "スレッド1", labels: undefined },
                        { text: "スレッド2", labels: undefined },
                    ],
                    createdAt: "2026-01-01T00:00:00Z",
                    updatedAt: "2026-01-01T00:00:00Z",
                },
            ],
        })
    })

    it("draftsが無ければ undefined", () => {
        expect(parseDraftViewsResponse({})).toBeUndefined()
    })

    it("1件でも不正なdraftViewがあれば undefined", () => {
        expect(
            parseDraftViewsResponse({ drafts: [{ id: "x" }] }),
        ).toBeUndefined()
    })
})
