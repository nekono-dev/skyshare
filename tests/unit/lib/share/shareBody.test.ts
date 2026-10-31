// 共有の本文とリンクカード（P0・要件 2.1 の「共有の文字数と URL の規則」）: URL の取り除きと補わない規則
import { describe, expect, it } from "vitest"
import { resolveShareBody } from "@/lib/share/shareBody"

const text = "見て https://a.example\n\n\n\nおわり"
const linkFacet = {
    index: { byteStart: 7, byteEnd: 24 },
    features: [
        {
            $type: "app.bsky.richtext.facet#link" as const,
            uri: "https://a.example",
        },
    ],
}
const ENTRY_URL = "https://skyshare.test/entry/1"

describe("resolveShareBody", () => {
    it("removes the body link and does not add the link card when the skyshare link card is preferred", () => {
        expect(
            resolveShareBody({
                text,
                facets: [linkFacet],
                entryUrl: ENTRY_URL,
                linkCardUrl: "https://a.example",
                preferSkyshareLinkCard: true,
            }),
        ).toEqual({ text: "見て\n\nおわり", linkCardUrl: "" })
    })

    it("keeps the text and the link card as they are when the preference is off", () => {
        expect(
            resolveShareBody({
                text,
                facets: [linkFacet],
                entryUrl: ENTRY_URL,
                linkCardUrl: "https://a.example",
                preferSkyshareLinkCard: false,
            }),
        ).toEqual({ text, linkCardUrl: "https://a.example" })
    })

    it("keeps the text when no entry URL is included in the share", () => {
        expect(
            resolveShareBody({
                text,
                facets: [linkFacet],
                entryUrl: null,
                linkCardUrl: "https://a.example",
                preferSkyshareLinkCard: true,
            }),
        ).toEqual({ text, linkCardUrl: "https://a.example" })
    })

    it("keeps the text when the body has no link facet to remove", () => {
        expect(
            resolveShareBody({
                text: "ただの本文",
                facets: [],
                entryUrl: ENTRY_URL,
                linkCardUrl: "",
                preferSkyshareLinkCard: true,
            }),
        ).toEqual({ text: "ただの本文", linkCardUrl: "" })
    })
})
