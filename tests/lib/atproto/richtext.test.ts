import { describe, expect, it } from "vitest"

import { extractLinkUrisFromFacets } from "@/lib/atproto/richtext"

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
