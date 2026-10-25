import { afterEach, describe, expect, it, vi } from "vitest"

import { fetchVideoDurationSec } from "@/lib/video/fetchVideoDuration"

const MASTER = "https://video.bsky.app/watch/did/cid/playlist.m3u8"

const stubFetch = (map: Record<string, string | number>) => {
    vi.stubGlobal(
        "fetch",
        vi.fn(async (url: string) => {
            const body = map[url]
            if (body === undefined || typeof body === "number") {
                return new Response("", {
                    status: typeof body === "number" ? body : 404,
                })
            }
            return new Response(body)
        }),
    )
}

afterEach(() => {
    vi.unstubAllGlobals()
})

describe("fetchVideoDurationSec", () => {
    it("マスター→最初のバリアント→EXTINF 合計を返す（相対 URL を解決）", async () => {
        stubFetch({
            [MASTER]:
                "#EXTM3U\n#EXT-X-STREAM-INF:BANDWIDTH=1\n360p/video.m3u8\n#EXT-X-STREAM-INF:BANDWIDTH=2\n720p/video.m3u8\n",
            "https://video.bsky.app/watch/did/cid/360p/video.m3u8":
                "#EXTM3U\n#EXTINF:4.0,\na.ts\n#EXTINF:4.0,\nb.ts\n#EXTINF:2.5,\nc.ts\n#EXT-X-ENDLIST\n",
        })
        expect(await fetchVideoDurationSec(MASTER)).toBeCloseTo(10.5)
    })

    it("マスターの取得失敗で throw", async () => {
        stubFetch({})
        await expect(fetchVideoDurationSec(MASTER)).rejects.toThrow()
    })

    it("バリアントの取得失敗で throw", async () => {
        stubFetch({ [MASTER]: "#EXTM3U\nv.m3u8\n" })
        await expect(fetchVideoDurationSec(MASTER)).rejects.toThrow()
    })

    it("EXTINF が無ければ throw", async () => {
        stubFetch({
            [MASTER]: "#EXTM3U\nv.m3u8\n",
            "https://video.bsky.app/watch/did/cid/v.m3u8": "#EXTM3U\n",
        })
        await expect(fetchVideoDurationSec(MASTER)).rejects.toThrow()
    })
})
