/**
 * 動画の静的表示（`VideoThumbnail`）と、投稿レコードからの動画の抽出を合わせたテスト。
 */
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"

import VideoThumbnail from "@/components/video/VideoThumbnail"
import { extractEmbedVideo } from "@/lib/entry/entry"

/** 投稿レコードの動画の埋め込みを組み立てる。 */
const embedOf = (extra: Record<string, unknown> = {}) =>
    ({
        $type: "app.bsky.embed.video",
        video: {
            $type: "blob",
            ref: { $link: "bafkreivideo" },
            mimeType: "video/mp4",
            size: 10,
        },
        ...extra,
    }) as never

const render = (embed: never) => {
    const video = extractEmbedVideo(embed, "did:plc:abc")!
    return renderToStaticMarkup(createElement(VideoThumbnail, { video }))
}

describe("VideoThumbnail", () => {
    it("[video-player/AC-7] 代替テキストのある動画のposterに、その代替テキストが設定される", () => {
        const html = render(embedOf({ alt: "海を泳ぐ魚" }))
        expect(html).toMatch(/<img[^>]*alt="海を泳ぐ魚"/)
        expect(html).toContain("thumbnail.jpg")
    })

    it("[video-player/AC-9] 他のクライアントで作成した動画の投稿（代替テキストと縦横比が無い）も、posterと再生ボタンで表示される", () => {
        const html = render(embedOf())
        // posterは投稿の埋め込みから組み立てたURLで、再生ボタンを重ねる
        expect(html).toContain(
            "https://video.bsky.app/watch/did%3Aplc%3Aabc/bafkreivideo/thumbnail.jpg",
        )
        expect(html).toContain('alt=""')
        expect(html).toContain("<svg")
        // 縦横比が無いときは16:9の表示領域になる
        expect(html).toContain("aspect-ratio:16 / 9")
    })
})
