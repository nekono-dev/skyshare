import { describe, expect, it } from "vitest"
import {
    filterLinkFacets,
    normalizePostFacets,
    removeFacetRanges,
    segmentRichText,
    type PostFacet,
    type PostFacetFeature,
} from "@/lib/atproto/richTextSegments"

const encoder = new TextEncoder()

/** 本文の中の文字列の位置から facet を作る（テスト用） */
const facetOf = (
    text: string,
    match: string,
    feature: PostFacetFeature,
): PostFacet => {
    const byteStart = encoder.encode(text.slice(0, text.indexOf(match))).length
    return {
        index: {
            byteStart,
            byteEnd: byteStart + encoder.encode(match).length,
        },
        features: [feature],
    }
}

describe("normalizePostFacets", () => {
    it("未知のfeatureと形の不正なfacetを除く", () => {
        expect(
            normalizePostFacets([
                {
                    index: { byteStart: 0, byteEnd: 2 },
                    features: [
                        { $type: "app.bsky.richtext.facet#tag", tag: "a" },
                        { $type: "app.bsky.richtext.facet#bold" },
                    ],
                },
                {
                    index: { byteStart: 0, byteEnd: 2 },
                    features: [{ $type: "app.bsky.richtext.facet#unknown" }],
                },
                { index: { byteStart: "0", byteEnd: 2 }, features: [] },
                null,
            ]),
        ).toEqual([
            {
                index: { byteStart: 0, byteEnd: 2 },
                features: [{ $type: "app.bsky.richtext.facet#tag", tag: "a" }],
            },
        ])
    })

    it("配列でない入力は空配列にする", () => {
        expect(normalizePostFacets(undefined)).toEqual([])
        expect(normalizePostFacets({})).toEqual([])
    })
})

describe("segmentRichText", () => {
    it("[post-rich-text/AC-1] メンション・ハッシュタグ・URLがそれぞれの遷移先を指す", () => {
        const text = "見て @alice.test #猫 https://example.com/a"
        const segments = segmentRichText(text, [
            facetOf(text, "@alice.test", {
                $type: "app.bsky.richtext.facet#mention",
                did: "did:plc:alice",
            }),
            facetOf(text, "#猫", {
                $type: "app.bsky.richtext.facet#tag",
                tag: "猫",
            }),
            facetOf(text, "https://example.com/a", {
                $type: "app.bsky.richtext.facet#link",
                uri: "https://example.com/a",
            }),
        ])
        expect(segments.filter(segment => segment.href)).toEqual([
            {
                text: "@alice.test",
                href: "https://bsky.app/profile/did:plc:alice",
            },
            {
                text: "#猫",
                href: "https://bsky.app/hashtag/%E7%8C%AB",
            },
            { text: "https://example.com/a", href: "https://example.com/a" },
        ])
    })

    it("[post-rich-text/AC-2] 区間を連結すると元の本文に一致する", () => {
        const text = "前 #a 中 #b 後"
        const segments = segmentRichText(text, [
            facetOf(text, "#a", {
                $type: "app.bsky.richtext.facet#tag",
                tag: "a",
            }),
            facetOf(text, "#b", {
                $type: "app.bsky.richtext.facet#tag",
                tag: "b",
            }),
        ])
        expect(segments.map(segment => segment.text).join("")).toBe(text)
        expect(segments[0]).toEqual({ text: "前 " })
    })

    it("[post-rich-text/AC-3] 範囲が本文の長さを超える注釈は無視して全文を文字のまま返す", () => {
        expect(
            segmentRichText("abc", [
                {
                    index: { byteStart: 0, byteEnd: 10 },
                    features: [
                        { $type: "app.bsky.richtext.facet#tag", tag: "abc" },
                    ],
                },
            ]),
        ).toEqual([{ text: "abc" }])
    })

    it("重なる注釈は先に始まる方だけをリンクにする", () => {
        const text = "#abc"
        const segments = segmentRichText(text, [
            {
                index: { byteStart: 0, byteEnd: 4 },
                features: [
                    { $type: "app.bsky.richtext.facet#tag", tag: "abc" },
                ],
            },
            {
                index: { byteStart: 1, byteEnd: 3 },
                features: [{ $type: "app.bsky.richtext.facet#tag", tag: "b" }],
            },
        ])
        expect(segments).toEqual([
            { text: "#abc", href: "https://bsky.app/hashtag/abc" },
        ])
    })

    it("文字の途中で切れる注釈は無視する", () => {
        // 「猫」は UTF-8 で3バイト。1バイト目の直後で切ると文字の途中になる
        expect(
            segmentRichText("猫", [
                {
                    index: { byteStart: 0, byteEnd: 1 },
                    features: [
                        { $type: "app.bsky.richtext.facet#tag", tag: "x" },
                    ],
                },
            ]),
        ).toEqual([{ text: "猫" }])
    })

    it("[post-rich-text/AC-4] リンク先がjavascriptの形式の注釈はリンクにならない", () => {
        const text = "click me"
        expect(
            segmentRichText(text, [
                {
                    index: { byteStart: 0, byteEnd: 5 },
                    features: [
                        {
                            $type: "app.bsky.richtext.facet#link",
                            uri: "javascript:alert(1)",
                        },
                    ],
                },
            ]),
        ).toEqual([{ text: "click me" }])
    })

    it("[post-rich-text/AC-7] 絵文字の後ろのハッシュタグは、ハッシュタグの文字だけをリンクにする", () => {
        const text = "😀👍 #tag です"
        const segments = segmentRichText(text, [
            facetOf(text, "#tag", {
                $type: "app.bsky.richtext.facet#tag",
                tag: "tag",
            }),
        ])
        expect(segments).toEqual([
            { text: "😀👍 " },
            { text: "#tag", href: "https://bsky.app/hashtag/tag" },
            { text: " です" },
        ])
    })

    it("[post-rich-text/AC-8] 注釈の無い部分のスキームを省略したURLをリンクにする", () => {
        const text = "#a 見てexample.comです"
        expect(
            segmentRichText(text, [
                facetOf(text, "#a", {
                    $type: "app.bsky.richtext.facet#tag",
                    tag: "a",
                }),
            ]),
        ).toEqual([
            { text: "#a", href: "https://bsky.app/hashtag/a" },
            { text: " 見て" },
            { text: "example.com", href: "https://example.com" },
            { text: "です" },
        ])
    })

    it("スキームを省略したuriのlinkの注釈は https を補う", () => {
        const text = "見て example.com"
        expect(
            segmentRichText(text, [
                facetOf(text, "example.com", {
                    $type: "app.bsky.richtext.facet#link",
                    uri: "example.com",
                }),
            ]),
        ).toEqual([
            { text: "見て " },
            { text: "example.com", href: "https://example.com" },
        ])
    })

    it("空の本文は空配列を返す", () => {
        expect(segmentRichText("", [])).toEqual([])
    })
})

describe("removeFacetRanges / filterLinkFacets", () => {
    it("linkのfacetの範囲だけを取り除く", () => {
        const text = "見て https://example.com #a"
        const facets = [
            facetOf(text, "https://example.com", {
                $type: "app.bsky.richtext.facet#link",
                uri: "https://example.com",
            }),
            facetOf(text, "#a", {
                $type: "app.bsky.richtext.facet#tag",
                tag: "a",
            }),
        ]
        expect(removeFacetRanges(text, filterLinkFacets(facets))).toBe(
            "見て  #a",
        )
    })
})
