import { describe, expect, it } from "vitest"

import {
    createExternalEmbed,
    createImageEmbed,
    validateImageMetadata,
} from "@/lib/atproto/embed"

describe("validateImageMetadata", () => {
    it("imagesが未指定/空配列なら何もしない", () => {
        expect(() => validateImageMetadata(undefined, undefined)).not.toThrow()
        expect(() => validateImageMetadata([], undefined)).not.toThrow()
    })

    it("imagesがあるのにimagesMetaが無ければthrow", () => {
        expect(() =>
            validateImageMetadata([new Blob(["a"])], undefined),
        ).toThrow()
    })

    it("件数が一致しなければthrow", () => {
        expect(() =>
            validateImageMetadata(
                [new Blob(["a"]), new Blob(["b"])],
                [{ width: 100, height: 100 }],
            ),
        ).toThrow()
    })

    it("件数が一致すればthrowしない", () => {
        expect(() =>
            validateImageMetadata(
                [new Blob(["a"]), new Blob(["b"])],
                [
                    { width: 100, height: 100 },
                    { width: 200, height: 200 },
                ],
            ),
        ).not.toThrow()
    })
})

describe("createImageEmbed", () => {
    it("blobとメタデータからembedを組み立てる", () => {
        expect(
            createImageEmbed(["blobRef1", "blobRef2"], [
                { width: 100, height: 100 },
                { width: 200, height: 200 },
            ]),
        ).toEqual({
            $type: "app.bsky.embed.images",
            images: [
                {
                    image: "blobRef1",
                    alt: "",
                    aspectRatio: { width: 100, height: 100 },
                },
                {
                    image: "blobRef2",
                    alt: "",
                    aspectRatio: { width: 200, height: 200 },
                },
            ],
        })
    })

    it("メタデータが無ければaspectRatioはundefined", () => {
        expect(createImageEmbed(["blobRef1"], undefined)).toEqual({
            $type: "app.bsky.embed.images",
            images: [{ image: "blobRef1", alt: "", aspectRatio: undefined }],
        })
    })
})

describe("createExternalEmbed", () => {
    const facets = [
        {
            features: [
                {
                    $type: "app.bsky.richtext.facet#link",
                    uri: "https://example.com",
                },
            ],
        },
    ]
    const ogMeta = { title: "Example", description: "desc" }

    it("facetsからリンクを抽出しexternal embedを組み立てる", () => {
        expect(createExternalEmbed(facets, ogMeta, "thumbBlobRef")).toEqual({
            $type: "app.bsky.embed.external",
            external: {
                uri: "https://example.com",
                title: "Example",
                description: "desc",
                thumb: "thumbBlobRef",
            },
        })
    })

    it("リンクが無ければthrow", () => {
        expect(() => createExternalEmbed(undefined, ogMeta, undefined)).toThrow()
    })
})
