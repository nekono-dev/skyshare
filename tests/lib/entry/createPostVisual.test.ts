import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { createPostVisualBlob } from "@/lib/entry/createPostVisual"
import type { TimelinePost } from "@/lib/entry/posts"

const { createDefaultThumbnail, getBskyImage } = vi.hoisted(() => ({
    createDefaultThumbnail: vi.fn(),
    getBskyImage: vi.fn(),
}))

vi.mock("@/lib/image/postImageProcessing", () => ({ createDefaultThumbnail }))
vi.mock("@/client/openapi/client", () => ({ getBskyImage }))

const PLAYLIST = "https://video.bsky.app/watch/did/cid/playlist.m3u8"
const THUMBNAIL = "https://video.bsky.app/watch/did/cid/thumbnail.jpg"

const basePost = (overrides: Partial<TimelinePost>): TimelinePost => ({
    uri: "at://did:plc:abc/app.bsky.feed.post/3l",
    cid: "cid",
    url: "https://bsky.app/profile/a/post/3l",
    indexedAt: "2026-01-01T00:00:00Z",
    author: { did: "did:plc:abc", handle: "a.bsky.social" },
    text: "",
    images: [],
    ...overrides,
})

const videoPost = basePost({
    video: {
        cid: "cid",
        playlistUrl: PLAYLIST,
        thumbnailUrl: THUMBNAIL,
        alt: "",
    },
})

type Responses = Record<string, Response | (() => Response)>

const stubFetch = (responses: Responses) => {
    const fetchMock = vi.fn(async (url: string) => {
        const response = responses[url]
        if (!response) return new Response("", { status: 404 })
        return typeof response === "function" ? response() : response
    })
    vi.stubGlobal("fetch", fetchMock)
    return fetchMock
}

const okResponses = (): Responses => ({
    [PLAYLIST]: new Response("#EXTM3U\n360p.m3u8\n"),
    "https://video.bsky.app/watch/did/cid/360p.m3u8": new Response(
        "#EXTM3U\n#EXTINF:4.0,\na.ts\n#EXTINF:2.5,\nb.ts\n",
    ),
    [THUMBNAIL]: new Response(new Blob(["jpg"])),
})

beforeEach(() => {
    createDefaultThumbnail.mockReset()
    createDefaultThumbnail.mockResolvedValue(new Blob(["visual"]))
    getBskyImage.mockReset()
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:poster")
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined)
})

afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
})

describe("createPostVisualBlob（動画投稿）", () => {
    it("[entry-visual/AC-9] thumbnail.jpg と playlist.m3u8 を取得し、overlay 付きで createDefaultThumbnail を呼ぶ", async () => {
        const fetchMock = stubFetch(okResponses())
        const { blob, videoDurationSec } = await createPostVisualBlob(videoPost)

        const urls = fetchMock.mock.calls.map(call => call[0])
        expect(urls).toContain(THUMBNAIL)
        expect(urls).toContain(PLAYLIST)
        expect(createDefaultThumbnail).toHaveBeenCalledTimes(1)
        const [objectUrls, overlay] = createDefaultThumbnail.mock.calls[0]
        expect(objectUrls).toEqual(["blob:poster"])
        expect(typeof overlay).toBe("function")
        expect(blob).toBeInstanceOf(Blob)
        expect(videoDurationSec).toBe(6.5)
        expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:poster")
        expect(getBskyImage).not.toHaveBeenCalled()
    })

    it("poster の Blob の type が空でも image/jpeg として渡す", async () => {
        stubFetch(okResponses())
        await createPostVisualBlob(videoPost)
        const created = vi.mocked(URL.createObjectURL).mock.calls[0][0] as Blob
        expect(created.type).toBe("image/jpeg")
    })

    it("[entry-visual/AC-10] 再生時間を取得できなければ throw し、visual を作らない", async () => {
        stubFetch({
            ...okResponses(),
            [PLAYLIST]: new Response("", { status: 404 }),
        })
        await expect(createPostVisualBlob(videoPost)).rejects.toThrow()
        expect(createDefaultThumbnail).not.toHaveBeenCalled()
    })

    it("poster の取得に失敗したら throw する", async () => {
        stubFetch({
            ...okResponses(),
            [THUMBNAIL]: new Response("", { status: 500 }),
        })
        await expect(createPostVisualBlob(videoPost)).rejects.toThrow()
        expect(createDefaultThumbnail).not.toHaveBeenCalled()
    })
})

describe("createPostVisualBlob（画像投稿）", () => {
    it("[entry-visual/AC-9] 先頭 4 枚だけを取得し、overlay なしで合成する", async () => {
        getBskyImage.mockResolvedValue({ status: 200, data: new Blob(["img"]) })
        const images = Array.from({ length: 6 }, (_, i) => ({
            url: `u${i}`,
            alt: "",
            cid: `c${i}`,
        }))
        await createPostVisualBlob(basePost({ images }))
        expect(getBskyImage).toHaveBeenCalledTimes(4)
        expect(createDefaultThumbnail.mock.calls[0][1]).toBeUndefined()
    })

    it("画像の取得に失敗したら throw する", async () => {
        getBskyImage.mockResolvedValue({ status: 404, data: {} })
        await expect(
            createPostVisualBlob(
                basePost({ images: [{ url: "u", alt: "", cid: "c" }] }),
            ),
        ).rejects.toThrow()
    })
})
