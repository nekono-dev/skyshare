import { describe, expect, it } from "vitest"

import {
    countHashtagUsage,
    extractLinkUrisFromFacets,
    extractTagsFromFacets,
} from "@/lib/atproto/richtext"

describe("extractLinkUrisFromFacets", () => {
    it("facet配列からlink URIを抽出する", () => {
        expect(
            extractLinkUrisFromFacets([
                {
                    features: [
                        {
                            $type: "app.bsky.richtext.facet#link",
                            uri: "https://example.com",
                        },
                    ],
                },
            ]),
        ).toEqual(["https://example.com"])
    })

    it("feature配列を直接渡しても抽出できる", () => {
        expect(
            extractLinkUrisFromFacets([
                { $type: "app.bsky.richtext.facet#link", uri: "https://a" },
            ]),
        ).toEqual(["https://a"])
    })

    it("facetsプロパティを持つオブジェクトからも抽出できる", () => {
        expect(
            extractLinkUrisFromFacets({
                facets: [
                    {
                        features: [
                            {
                                $type: "app.bsky.richtext.facet#link",
                                uri: "https://b",
                            },
                        ],
                    },
                ],
            }),
        ).toEqual(["https://b"])
    })

    it("重複するURIは1つにまとめる", () => {
        expect(
            extractLinkUrisFromFacets([
                {
                    features: [
                        {
                            $type: "app.bsky.richtext.facet#link",
                            uri: "https://a",
                        },
                    ],
                },
                {
                    features: [
                        {
                            $type: "app.bsky.richtext.facet#link",
                            uri: "https://a",
                        },
                    ],
                },
            ]),
        ).toEqual(["https://a"])
    })

    it("link以外のfeatureは無視する", () => {
        expect(
            extractLinkUrisFromFacets([
                {
                    features: [
                        { $type: "app.bsky.richtext.facet#mention", did: "x" },
                    ],
                },
            ]),
        ).toEqual([])
    })

    it("未指定・空入力は空配列", () => {
        expect(extractLinkUrisFromFacets(undefined)).toEqual([])
        expect(extractLinkUrisFromFacets(null)).toEqual([])
        expect(extractLinkUrisFromFacets([])).toEqual([])
    })
})

describe("extractTagsFromFacets", () => {
    it("facet配列からタグを抽出する（#を含まない）", () => {
        expect(
            extractTagsFromFacets([
                {
                    features: [
                        { $type: "app.bsky.richtext.facet#tag", tag: "猫" },
                    ],
                },
            ]),
        ).toEqual(["猫"])
    })

    it("feature配列を直接渡しても抽出できる", () => {
        expect(
            extractTagsFromFacets([
                { $type: "app.bsky.richtext.facet#tag", tag: "bluesky" },
            ]),
        ).toEqual(["bluesky"])
    })

    it("重複するタグは1つにまとめる", () => {
        expect(
            extractTagsFromFacets([
                {
                    features: [
                        { $type: "app.bsky.richtext.facet#tag", tag: "猫" },
                    ],
                },
                {
                    features: [
                        { $type: "app.bsky.richtext.facet#tag", tag: "猫" },
                    ],
                },
            ]),
        ).toEqual(["猫"])
    })

    it("tag以外のfeatureは無視する", () => {
        expect(
            extractTagsFromFacets([
                {
                    features: [
                        {
                            $type: "app.bsky.richtext.facet#link",
                            uri: "https://a",
                        },
                    ],
                },
            ]),
        ).toEqual([])
    })

    it("未指定・空入力は空配列", () => {
        expect(extractTagsFromFacets(undefined)).toEqual([])
        expect(extractTagsFromFacets(null)).toEqual([])
        expect(extractTagsFromFacets([])).toEqual([])
    })
})

describe("countHashtagUsage", () => {
    it("複数投稿にまたがるタグ使用数を集計する", () => {
        expect(
            countHashtagUsage(["#猫 かわいい", "#猫 と #犬", "#犬"]),
        ).toEqual([
            { tag: "猫", count: 2 },
            { tag: "犬", count: 2 },
        ])
    })

    it("同一投稿内で同じタグを複数回使っても1件として数える", () => {
        expect(countHashtagUsage(["#猫 #猫 #猫"])).toEqual([
            { tag: "猫", count: 1 },
        ])
    })

    it("大文字小文字を無視してマージする（表記は最初の出現を採用）", () => {
        expect(countHashtagUsage(["#Bluesky", "#bluesky"])).toEqual([
            { tag: "Bluesky", count: 2 },
        ])
    })

    it("使用数の多い順（降順）にソートして返す", () => {
        expect(countHashtagUsage(["#a", "#a", "#a", "#b", "#b", "#c"])).toEqual(
            [
                { tag: "a", count: 3 },
                { tag: "b", count: 2 },
                { tag: "c", count: 1 },
            ],
        )
    })

    it("ハッシュタグを含まない投稿・空配列は無視する", () => {
        expect(countHashtagUsage(["ハッシュタグなし", ""])).toEqual([])
        expect(countHashtagUsage([])).toEqual([])
    })
})
