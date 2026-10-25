/**
 * サムネイル（`ImageGallery`）のサーバー描画のテスト。
 */
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"

import ImageGallery from "@/components/image/ImageGallery"

const images = [
    { url: "/a.png", alt: "Aの代替", cid: "a" },
    { url: "/b.png", alt: "Bの代替", cid: "b" },
]

describe("ImageGallery", () => {
    it("[image-gallery/AC-10] 拡大表示を持たない静的な表示の指定があり、指定するとサムネイルがボタンにならない", () => {
        const interactive = renderToStaticMarkup(
            createElement(ImageGallery, { images }),
        )
        expect(interactive.match(/<button/g)).toHaveLength(2)

        const staticView = renderToStaticMarkup(
            createElement(ImageGallery, { images, interactive: false }),
        )
        expect(staticView).not.toContain("<button")
        expect(staticView.match(/<img/g)).toHaveLength(2)
    })

    it("[image-gallery/AC-4] 各サムネイルに、画像の代替テキストが設定される", () => {
        for (const interactive of [true, false]) {
            const html = renderToStaticMarkup(
                createElement(ImageGallery, { images, interactive }),
            )
            expect(html).toContain('alt="Aの代替"')
            expect(html).toContain('alt="Bの代替"')
        }
    })
})
