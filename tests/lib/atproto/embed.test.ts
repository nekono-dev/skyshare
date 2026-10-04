import { describe, expect, it } from "vitest"

import {
    createExternalEmbed,
    createImageEmbed,
    createVideoEmbed,
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
                [{ width: 100, height: 100, alt: "" }],
            ),
        ).toThrow()
    })

    it("11枚以上はthrow、10枚はthrowしない", () => {
        const meta = (n: number) =>
            Array.from({ length: n }, () => ({
                width: 100,
                height: 100,
                alt: "",
            }))
        const blobs = (n: number) =>
            Array.from({ length: n }, () => new Blob(["a"]))
        expect(() => validateImageMetadata(blobs(11), meta(11))).toThrow()
        expect(() => validateImageMetadata(blobs(10), meta(10))).not.toThrow()
    })

    it("件数が一致すればthrowしない", () => {
        expect(() =>
            validateImageMetadata(
                [new Blob(["a"]), new Blob(["b"])],
                [
                    { width: 100, height: 100, alt: "" },
                    { width: 200, height: 200, alt: "" },
                ],
            ),
        ).not.toThrow()
    })
})

describe("createImageEmbed", () => {
    it("blobとメタデータからembedを組み立てる", () => {
        expect(
            createImageEmbed(
                ["blobRef1", "blobRef2"],
                [
                    { width: 100, height: 100, alt: "" },
                    { width: 200, height: 200, alt: "猫の写真" },
                ],
            ),
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
                    alt: "猫の写真",
                    aspectRatio: { width: 200, height: 200 },
                },
            ],
        })
    })

    it("4枚はimages型のまま", () => {
        const embed = createImageEmbed(
            ["b1", "b2", "b3", "b4"],
            Array.from({ length: 4 }, () => ({ width: 1, height: 1, alt: "" })),
        )
        expect(embed.$type).toBe("app.bsky.embed.images")
    })

    it.each([5, 10])("%d枚はgallery型で順序・alt・aspectRatioを保持する", n => {
        const blobs = Array.from({ length: n }, (_, i) => `blob${i}`)
        const meta = Array.from({ length: n }, (_, i) => ({
            width: 100 + i,
            height: 200 + i,
            alt: `alt${i}`,
        }))
        expect(createImageEmbed(blobs, meta)).toEqual({
            $type: "app.bsky.embed.gallery",
            items: blobs.map((blob, i) => ({
                $type: "app.bsky.embed.gallery#image",
                image: blob,
                alt: `alt${i}`,
                aspectRatio: { width: 100 + i, height: 200 + i },
            })),
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
    const ogMeta = {
        title: "Example",
        description: "desc",
        url: "https://example.com",
    }

    it("ogMeta.urlからexternal embedを組み立てる", () => {
        expect(createExternalEmbed(ogMeta, "thumbBlobRef")).toEqual({
            $type: "app.bsky.embed.external",
            external: {
                uri: "https://example.com",
                title: "Example",
                description: "desc",
                thumb: "thumbBlobRef",
            },
        })
    })

    it("ogMeta.urlが無ければthrow", () => {
        expect(() =>
            createExternalEmbed({ ...ogMeta, url: "" }, undefined),
        ).toThrow()
    })
})

describe("createVideoEmbed", () => {
    const blob = {
        $type: "blob" as const,
        ref: { $link: "bafkreivideo" },
        mimeType: "video/mp4" as const,
        size: 10,
    }

    it("blob参照・alt・縦横比を保持する", () => {
        expect(
            createVideoEmbed(blob, { width: 640, height: 360, alt: "海" }),
        ).toEqual({
            $type: "app.bsky.embed.video",
            video: blob,
            alt: "海",
            aspectRatio: { width: 640, height: 360 },
        })
    })

    it("altが未指定なら空文字", () => {
        expect(createVideoEmbed(blob, { width: 1, height: 1 } as any).alt).toBe(
            "",
        )
    })
})
