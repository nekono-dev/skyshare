import { describe, test, expect } from "@jest/globals"
import detectFacets from "../src/utils/atproto_api/detectFacets"

describe("detectFacets Test", () => {
    test("hello world", async () => {
        const result = await detectFacets({
            text: "hello world!",
        })
        expect(result).toEqual([])
    })
    test("Link facets", async () => {
        const result = await detectFacets({
            text: "this is https://link1 https://link2",
        })
        expect(result).toEqual(
            expect.arrayContaining([
                {
                    index: {
                        byteStart: 8,
                        byteEnd: 21,
                    },
                    features: [
                        {
                            $type: "app.bsky.richtext.facet#link",
                            uri: "https://link1",
                        },
                    ],
                },
                {
                    index: {
                        byteStart: 22,
                        byteEnd: 35,
                    },
                    features: [
                        {
                            $type: "app.bsky.richtext.facet#link",
                            uri: "https://link2",
                        },
                    ],
                },
            ]),
        )
    })

    test("mentions facets", async () => {
        const result = await detectFacets({
            text: "iam @nekono.dev at @bsky.app",
        })
        expect(result).toEqual(
            expect.arrayContaining([
                {
                    index: {
                        byteStart: 4,
                        byteEnd: 15,
                    },
                    features: [
                        {
                            $type: "app.bsky.richtext.facet#mention",
                            did: "did:plc:arvsmkkcflx2hdfum5jk54n3",
                        },
                    ],
                },
                {
                    index: {
                        byteStart: 19,
                        byteEnd: 28,
                    },
                    features: [
                        {
                            $type: "app.bsky.richtext.facet#mention",
                            did: "did:plc:z72i7hdynmk6r22z27h6tvur",
                        },
                    ],
                },
            ]),
        )
    }, 100000) // long timeouf

    test("mention and link facets", async () => {
        const result = await detectFacets({
            text: "Thanx @bsky.app https://bsky.app/ !",
        })
        expect(result).toEqual(
            expect.arrayContaining([
                {
                    index: {
                        byteStart: 6,
                        byteEnd: 15,
                    },
                    features: [
                        {
                            $type: "app.bsky.richtext.facet#mention",
                            did: "did:plc:z72i7hdynmk6r22z27h6tvur",
                        },
                    ],
                },
                {
                    index: {
                        byteStart: 16,
                        byteEnd: 33,
                    },
                    features: [
                        {
                            $type: "app.bsky.richtext.facet#link",
                            uri: "https://bsky.app/",
                        },
                    ],
                },
            ]),
        )
    }, 100000) // long timeouf

    // byteStart,byteEnd seems decided by UTF-8 characode
    test("Link facets including Japanese", async () => {
        const result = await detectFacets({
            text: "にほんご https://link1",
        })
        expect(result).toEqual(
            expect.arrayContaining([
                {
                    index: {
                        byteStart: 13,
                        byteEnd: 26,
                    },
                    features: [
                        {
                            $type: "app.bsky.richtext.facet#link",
                            uri: "https://link1",
                        },
                    ],
                },
            ]),
        )
    })

    // japanese link
    test("Link facets including Japanese-domain", async () => {
        const result = await detectFacets({
            text: "https://日本語.jp here",
        })
        expect(result).toEqual(
            expect.arrayContaining([
                {
                    index: {
                        byteStart: 0,
                        byteEnd: 20,
                    },
                    features: [
                        {
                            $type: "app.bsky.richtext.facet#link",
                            uri: "https://日本語.jp",
                        },
                    ],
                },
            ]),
        )
    })

    // newline is 1 byte
    test("Link facets including text after Newline", async () => {
        const result = await detectFacets({
            text: "test post\nhttps://hogehoge/",
        })
        expect(result).toEqual(
            expect.arrayContaining([
                {
                    index: {
                        byteStart: 10,
                        byteEnd: 27,
                    },
                    features: [
                        {
                            $type: "app.bsky.richtext.facet#link",
                            uri: "https://hogehoge/",
                        },
                    ],
                },
            ]),
        )
    })

    test("Link facets including text before Newline", async () => {
        const result = await detectFacets({
            text: "https://hogehoge\ntest post",
        })
        expect(result).toEqual(
            expect.arrayContaining([
                {
                    index: {
                        byteStart: 0,
                        byteEnd: 16,
                    },
                    features: [
                        {
                            $type: "app.bsky.richtext.facet#link",
                            uri: "https://hogehoge",
                        },
                    ],
                },
            ]),
        )
    })

    test("Hashtag facets", async () => {
        const result = await detectFacets({
            text: "#hashtag",
        })
        expect(result).toEqual(
            expect.arrayContaining([
                {
                    index: {
                        byteStart: 0,
                        byteEnd: 8,
                    },
                    features: [
                        {
                            $type: "app.bsky.richtext.facet#tag",
                            tag: "hashtag",
                        },
                    ],
                },
            ]),
        )
    })

    test("Multi Hashtags facets", async () => {
        const result = await detectFacets({
            text: "test #hashtag #hash2",
        })
        expect(result).toEqual(
            expect.arrayContaining([
                {
                    index: {
                        byteStart: 5,
                        byteEnd: 13,
                    },
                    features: [
                        {
                            $type: "app.bsky.richtext.facet#tag",
                            tag: "hashtag",
                        },
                    ],
                },
                {
                    index: {
                        byteStart: 14,
                        byteEnd: 20,
                    },
                    features: [
                        {
                            $type: "app.bsky.richtext.facet#tag",
                            tag: "hash2",
                        },
                    ],
                },
            ]),
        )
    })

    test("Bsky not supported Hashtag facets", async () => {
        const result = await detectFacets({
            text: "#C# #0",
        })
        expect(result).toEqual(
            expect.arrayContaining([
                {
                    index: {
                        byteStart: 0,
                        byteEnd: 3,
                    },
                    features: [
                        {
                            $type: "app.bsky.richtext.facet#tag",
                            tag: "C#",
                        },
                    ],
                },
                {
                    index: {
                        byteStart: 4,
                        byteEnd: 6,
                    },
                    features: [
                        {
                            $type: "app.bsky.richtext.facet#tag",
                            tag: "0",
                        },
                    ],
                },
            ]),
        )
    })
    test("Bad hashtag#️⃣ enable facet", async () => {
        const result = await detectFacets({
            text: "#️⃣0",
        })
        expect(result).toEqual(
            expect.arrayContaining([
                {
                    index: {
                        byteStart: 0,
                        byteEnd: 8,
                    },
                    features: [
                        {
                            $type: "app.bsky.richtext.facet#tag",
                            tag: "️⃣0",
                        },
                    ],
                },
            ]),
        )
    })

    test("no existing mention", async () => {
        const result = await detectFacets({
            text: "#test @0 ignore",
        })
        expect(result).toEqual(
            expect.arrayContaining([
                {
                    index: {
                        byteStart: 0,
                        byteEnd: 5,
                    },
                    features: [
                        {
                            $type: "app.bsky.richtext.facet#tag",
                            tag: "test",
                        },
                    ],
                },
            ]),
        )
    }, 100000) // long timeouf
})
