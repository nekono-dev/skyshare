import { beforeEach, describe, expect, it, vi } from "vitest"
import { createEmptySegment } from "@/components/post/ThreadComposer/segments"
import { submitThread } from "@/components/post/ThreadComposer/submitThread"
import type { ImageEntry } from "@/components/image/ImagePicker"
import { createEntry } from "@/client/openapi/client"
import { warmOgpCache } from "@/lib/entry/warmOgpCache"

vi.mock("@/client/openapi/client", () => ({
    createEntry: vi.fn(),
}))

vi.mock("@/lib/entry/warmOgpCache", () => ({
    warmOgpCache: vi.fn().mockResolvedValue(undefined),
}))

vi.mock("@/lib/atproto/richtext", () => ({
    detectFacetsForSubmission: vi.fn().mockResolvedValue(undefined),
}))

/**
 * テスト用の画像投稿セグメントを組み立てる。
 *
 * Input:
 * - `overrides`: 上書きしたいImageEntryフィールド
 *
 * Output:
 * - `images`/`imagesMeta`が完全に揃った画像投稿セグメント
 */
const buildImageEntry = (overrides: Partial<ImageEntry> = {}): ImageEntry => ({
    originalBlobs: [new Blob(["a"])],
    thumbnailBlob: new Blob(["thumb"]),
    originalPreviews: [],
    thumbnailPreview: "",
    sourceFileNames: ["a.png"],
    meta: [{ width: 100, height: 100, alt: "" }],
    ...overrides,
})

const mockCreateEntryOk = (
    posts: { url: string; uri: string; cid: string }[],
    skyshareEntry?: { uri: string },
) => {
    vi.mocked(createEntry).mockResolvedValue({
        status: 200,
        data: { posts, skyshareEntry },
    } as never)
}

type SubmitThreadBody = {
    posts: Record<string, unknown>[]
    createEntry?: boolean
    visual?: unknown
}

beforeEach(() => {
    vi.clearAllMocks()
})

describe("submitThread", () => {
    it("単一セグメント(テキストのみ)を posts 1件として送信する", async () => {
        mockCreateEntryOk([{ url: "https://x", uri: "at://1", cid: "c1" }])

        const segment = { ...createEmptySegment("ja"), text: "hello" }
        const result = await submitThread({
            segments: [segment],
            manualImageAttach: false,
        })

        expect(result).toEqual({ ok: true, skyshareUri: "" })
        expect(createEntry).toHaveBeenCalledTimes(1)
        const body = vi.mocked(createEntry).mock.calls[0][0] as SubmitThreadBody
        expect(body.posts).toHaveLength(1)
        expect(body.posts[0].text).toBe("hello")
        expect(body.posts[0]).not.toHaveProperty("createEntry")
        expect(body.createEntry).toBeUndefined()
    })

    it("単一セグメント(画像)では、トップレベルcreateEntry:true+visualを送る(NFR-1)", async () => {
        mockCreateEntryOk([{ url: "https://x", uri: "at://1", cid: "c1" }], {
            uri: "https://skyshare/1",
        })

        const segment = {
            ...createEmptySegment("ja"),
            text: "画像投稿",
            imageEntry: buildImageEntry(),
        }
        const result = await submitThread({
            segments: [segment],
            manualImageAttach: false,
        })

        expect(result).toEqual({ ok: true, skyshareUri: "https://skyshare/1" })
        const body = vi.mocked(createEntry).mock.calls[0][0] as SubmitThreadBody
        expect(body.createEntry).toBe(true)
        expect(body.visual).toBeDefined()
        expect(body.posts[0]).not.toHaveProperty("createEntry")
        expect(body.posts[0]).not.toHaveProperty("ogImage")
    })

    it("画像投稿segmentが0件のスレッドでは、createEntry/visualを送らない", async () => {
        mockCreateEntryOk([
            { url: "https://x/1", uri: "at://1", cid: "c1" },
            { url: "https://x/2", uri: "at://2", cid: "c2" },
        ])

        const segments = [
            { ...createEmptySegment("ja"), text: "1件目" },
            { ...createEmptySegment("ja"), text: "2件目" },
        ]
        const result = await submitThread({
            segments,
            manualImageAttach: false,
        })

        expect(result).toEqual({ ok: true, skyshareUri: "" })
        const body = vi.mocked(createEntry).mock.calls[0][0] as SubmitThreadBody
        expect(body.createEntry).toBeUndefined()
        expect(body.visual).toBeUndefined()
        expect(body.posts.every(p => !("createEntry" in p))).toBe(true)
    })

    it("画像投稿segmentが1件のスレッドでは、そのsegmentのthumbnailBlobがトップレベルvisualになる", async () => {
        mockCreateEntryOk(
            [
                { url: "https://x/1", uri: "at://1", cid: "c1" },
                { url: "https://x/2", uri: "at://2", cid: "c2" },
            ],
            { uri: "https://skyshare/2" },
        )

        const imageEntry = buildImageEntry()
        const segments = [
            { ...createEmptySegment("ja"), text: "1件目(テキストのみ)" },
            {
                ...createEmptySegment("ja"),
                text: "2件目(画像)",
                imageEntry,
            },
        ]
        const result = await submitThread({
            segments,
            manualImageAttach: false,
        })

        expect(result).toEqual({ ok: true, skyshareUri: "https://skyshare/2" })
        const body = vi.mocked(createEntry).mock.calls[0][0] as SubmitThreadBody
        expect(body.createEntry).toBe(true)
        expect(body.visual).toBe(imageEntry.thumbnailBlob)
        expect(body.posts[0]).not.toHaveProperty("createEntry")
        expect(body.posts[1]).not.toHaveProperty("createEntry")
        expect(warmOgpCache).toHaveBeenCalledWith("https://skyshare/2")
    })

    it("画像投稿segmentが複数あるスレッドでは、先頭のsegmentのthumbnailBlobのみが自動選択される", async () => {
        mockCreateEntryOk(
            [
                { url: "https://x/1", uri: "at://1", cid: "c1" },
                { url: "https://x/2", uri: "at://2", cid: "c2" },
            ],
            { uri: "https://skyshare/1" },
        )

        const firstImageEntry = buildImageEntry()
        const secondImageEntry = buildImageEntry()
        const segments = [
            {
                ...createEmptySegment("ja"),
                text: "1件目(画像)",
                imageEntry: firstImageEntry,
            },
            {
                ...createEmptySegment("ja"),
                text: "2件目(画像)",
                imageEntry: secondImageEntry,
            },
        ]
        const result = await submitThread({
            segments,
            manualImageAttach: false,
        })

        expect(result).toEqual({ ok: true, skyshareUri: "https://skyshare/1" })
        const body = vi.mocked(createEntry).mock.calls[0][0] as SubmitThreadBody
        // 画像投稿segmentが複数あっても、entryはリクエスト全体につき最大1件（先頭を自動選択）。
        // 2件目自身は独立したentryを作らないが、images自体は通常通り送信される。
        expect(body.createEntry).toBe(true)
        expect(body.visual).toBe(firstImageEntry.thumbnailBlob)
        expect(body.posts[1].images).toBeDefined()
        expect(warmOgpCache).toHaveBeenCalledWith("https://skyshare/1")
        expect(warmOgpCache).not.toHaveBeenCalledWith("https://skyshare/2")
    })

    it("manualImageAttachが有効な画像投稿ではcreateEntry/visualを送らない", async () => {
        mockCreateEntryOk([{ url: "https://x/1", uri: "at://1", cid: "c1" }])

        const segments = [
            {
                ...createEmptySegment("ja"),
                text: "画像だけ添付",
                imageEntry: buildImageEntry(),
            },
        ]
        const result = await submitThread({ segments, manualImageAttach: true })

        expect(result).toEqual({ ok: true, skyshareUri: "" })
        const body = vi.mocked(createEntry).mock.calls[0][0] as SubmitThreadBody
        expect(body.createEntry).toBeUndefined()
        expect(body.visual).toBeUndefined()
        expect(body.posts[0].images).toBeDefined()
    })

    it("createEntryを期待したのにトップレベルskyshareEntryが返らない場合は失敗にする", async () => {
        mockCreateEntryOk([{ url: "https://x/1", uri: "at://1", cid: "c1" }])

        const segments = [
            {
                ...createEmptySegment("ja"),
                text: "画像投稿",
                imageEntry: buildImageEntry(),
            },
        ]
        const result = await submitThread({
            segments,
            manualImageAttach: false,
        })

        expect(result).toEqual({
            ok: false,
            message:
                "Blueskyへの投稿は成功しましたが、SkyShareレコード作成に失敗しました。",
        })
    })

    it("APIが200以外を返した場合、エラーコードを文言に変換して失敗にする", async () => {
        vi.mocked(createEntry).mockResolvedValue({
            status: 400,
            data: { error: "APP_BSKY_POST_FAILED" },
        } as never)

        const result = await submitThread({
            segments: [{ ...createEmptySegment("ja"), text: "hello" }],
            manualImageAttach: false,
        })

        expect(result).toEqual({
            ok: false,
            message: "Blueskyへの投稿に失敗しました。",
        })
    })
})
