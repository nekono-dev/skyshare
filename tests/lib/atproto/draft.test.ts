import { describe, expect, it } from "vitest"

import {
    buildSelfLabels,
    extractLabelValues,
    parseCreateDraftBody,
    parseDeleteDraftBody,
    parseDraft,
    parseDraftPostInput,
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
    it("先頭投稿のtext/labelsを取り出す", () => {
        expect(
            parseDraft({
                posts: [
                    { text: "hello", labels: { values: [{ val: "sexual" }] } },
                ],
            }),
        ).toEqual({ text: "hello", labels: ["sexual"] })
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

describe("parseDraftPostInput / parseCreateDraftBody", () => {
    it("text単体を検証する", () => {
        expect(parseDraftPostInput({ text: "hello" })).toEqual({
            text: "hello",
            labels: undefined,
        })
        expect(parseCreateDraftBody).toBe(parseDraftPostInput)
    })

    it("labelsが文字列配列であれば受理する", () => {
        expect(
            parseDraftPostInput({ text: "hello", labels: ["sexual"] }),
        ).toEqual({ text: "hello", labels: ["sexual"] })
    })

    it("labelsが文字列配列でなければ undefined", () => {
        expect(
            parseDraftPostInput({ text: "hello", labels: "sexual" }),
        ).toBeUndefined()
        expect(
            parseDraftPostInput({ text: "hello", labels: [1, 2] }),
        ).toBeUndefined()
    })
})

describe("parseUpdateDraftBody", () => {
    it("id + text/labels を検証する", () => {
        expect(
            parseUpdateDraftBody({ id: "3ldrafttid", text: "hello" }),
        ).toEqual({ id: "3ldrafttid", text: "hello", labels: undefined })
    })

    it("idが無ければ undefined", () => {
        expect(parseUpdateDraftBody({ text: "hello" })).toBeUndefined()
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
    it("正常なレスポンスを検証する", () => {
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
                    text: "hello",
                    labels: undefined,
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
