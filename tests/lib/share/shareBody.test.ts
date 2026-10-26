import { describe, expect, it } from "vitest"
import { resolveShareBody } from "@/lib/share/shareBody"
import type { PostFacet } from "@/lib/atproto/richTextSegments"

const encoder = new TextEncoder()

/** 本文の中のURLの位置から link の facet を作る（テスト用） */
const linkFacet = (text: string, url: string): PostFacet => {
    const byteStart = encoder.encode(text.slice(0, text.indexOf(url))).length
    return {
        index: { byteStart, byteEnd: byteStart + encoder.encode(url).length },
        features: [{ $type: "app.bsky.richtext.facet#link", uri: url }],
    }
}

const ENTRY_URL = "https://skyshare.nekono.dev/entries/abc"
const LINK = "https://example.com/article"

describe("resolveShareBody", () => {
    it("[link-card-priority/2.1] 設定がONでentryのURLがあるとき、本文のURLを取り除く", () => {
        const text = `記事を読んだ ${LINK}`
        expect(
            resolveShareBody({
                text,
                facets: [linkFacet(text, LINK)],
                entryUrl: ENTRY_URL,
                linkCardUrl: "",
                preferSkyshareLinkCard: true,
            }).text,
        ).toBe("記事を読んだ")
    })

    it("[link-card-priority/2.2] 本文のURLを取り除いたとき、リンクカードのURLを補わない", () => {
        const text = `記事 ${LINK}`
        expect(
            resolveShareBody({
                text,
                facets: [linkFacet(text, LINK)],
                entryUrl: ENTRY_URL,
                linkCardUrl: LINK,
                preferSkyshareLinkCard: true,
            }).linkCardUrl,
        ).toBe("")
    })

    it("[link-card-priority/2.3] 設定がOFFのとき、本文のURLとリンクカードのURLを残す", () => {
        const text = `記事 ${LINK}`
        expect(
            resolveShareBody({
                text,
                facets: [linkFacet(text, LINK)],
                entryUrl: ENTRY_URL,
                linkCardUrl: LINK,
                preferSkyshareLinkCard: false,
            }),
        ).toEqual({ text, linkCardUrl: LINK })
    })

    it("[link-card-priority/2.3] entryのURLが無いとき、本文のURLを残す", () => {
        const text = `記事 ${LINK}`
        for (const entryUrl of [null, ""]) {
            expect(
                resolveShareBody({
                    text,
                    facets: [linkFacet(text, LINK)],
                    entryUrl,
                    linkCardUrl: "",
                    preferSkyshareLinkCard: true,
                }).text,
            ).toBe(text)
        }
    })

    it("[link-card-priority/2.4] 本文の途中のURLを取り除くと、行末の空白が残らず連続する改行が2行に詰まる", () => {
        const text = `はじめ ${LINK}\n\n\n\nおわり　`
        expect(
            resolveShareBody({
                text,
                facets: [linkFacet(text, LINK)],
                entryUrl: ENTRY_URL,
                linkCardUrl: "",
                preferSkyshareLinkCard: true,
            }).text,
        ).toBe("はじめ\n\nおわり")
    })

    it("本文にURLが無いときは、本文とリンクカードのURLをそのまま返す", () => {
        expect(
            resolveShareBody({
                text: "  そのまま  ",
                facets: [],
                entryUrl: ENTRY_URL,
                linkCardUrl: "",
                preferSkyshareLinkCard: true,
            }),
        ).toEqual({ text: "  そのまま  ", linkCardUrl: "" })
    })
})
