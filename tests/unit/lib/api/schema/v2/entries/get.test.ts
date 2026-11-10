/**
 * `GET /v2/entries` の応答の定義が、実際に返す動画の項目を受け入れることを確かめる。
 */
import { describe, expect, it } from "vitest"
import { ResponseBody200Schema } from "@/lib/api/schema/v2/entries/get"

describe("GET /v2/entries response schema", () => {
    it("accepts video fields returned by timeline posts", () => {
        const result = ResponseBody200Schema.safeParse({
            threads: [
                {
                    rootPost: {
                        uri: "at://did:plc:test/app.bsky.feed.post/1",
                        cid: "bafytest",
                        url: "https://bsky.app/profile/test/post/1",
                        indexedAt: "2026-11-10T00:00:00.000Z",
                        text: "video",
                        author: { did: "did:plc:test", handle: "test.example" },
                        images: [],
                        video: {
                            cid: "bafvideo",
                            playlistUrl: "https://video.example/playlist.m3u8",
                            thumbnailUrl: "https://video.example/thumbnail.jpg",
                            alt: "sample",
                            aspectRatio: { width: 16, height: 9 },
                        },
                        unsupportedVideo: {
                            cid: "bafunsupported",
                            playlistUrl: "https://video.example/playlist.m3u8",
                            thumbnailUrl: "https://video.example/thumbnail.jpg",
                            alt: "unsupported",
                        },
                    },
                    replies: [],
                },
            ],
        })
        expect(result.success).toBe(true)
    })
})
