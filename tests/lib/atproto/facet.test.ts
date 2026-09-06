import { describe, expect, it } from "vitest"

import { validateFacets } from "@/lib/atproto/facet"

const linkFacet = (byteStart: number, byteEnd: number) => ({
    index: { byteStart, byteEnd },
    features: [
        {
            $type: "app.bsky.richtext.facet#link" as const,
            uri: "https://example.com",
        },
    ],
})

describe("validateFacets", () => {
    it("facetsが未指定/空配列なら何もしない", () => {
        expect(() => validateFacets("hello", undefined)).not.toThrow()
        expect(() => validateFacets("hello", [])).not.toThrow()
    })

    it("indexが本文のバイト長に収まっていればthrowしない", () => {
        expect(() => validateFacets("foo bar", [linkFacet(4, 7)])).not.toThrow()
    })

    it("byteEndが本文のバイト長を超える場合はthrow", () => {
        expect(() => validateFacets("foo", [linkFacet(0, 100)])).toThrow()
    })

    it("byteStartがbyteEnd以上の場合はthrow", () => {
        expect(() => validateFacets("foo bar", [linkFacet(5, 5)])).toThrow()
        expect(() => validateFacets("foo bar", [linkFacet(6, 3)])).toThrow()
    })

    it("マルチバイト文字はUTF-8バイト長で判定する(UTF-16長ではない)", () => {
        // "猫" はUTF-8で3バイト。UTF-16のcode unit長(1)ではなくバイト長(3)で判定する。
        expect(() => validateFacets("猫", [linkFacet(0, 3)])).not.toThrow()
        expect(() => validateFacets("猫", [linkFacet(0, 4)])).toThrow()
    })
})
