/**
 * entry詳細ページの埋め込みの表示（`.kiro/specs/entry-detail`）のヘッドレスブラウザによる動作確認。
 * `entries/sample` の5件目（動画と引用）・6件目（リンクカード）を使う。
 */
import { expect, test } from "./fixtures"

test.describe("entry詳細ページの埋め込み", () => {
    test("[entry-detail/3.1] リンクカードを持つ投稿に、題名とドメインを持ちリンク先を新しいタブで開くカードが表示される", async ({
        page,
    }) => {
        await page.goto("/entries/sample/")
        const item = page.locator("li", { hasText: "スレッド6件目" })
        const card = item.getByTestId("post-link-card")
        await expect(card).toBeVisible()
        await expect(card).toContainText("Example Domain")
        await expect(card).toContainText("example.com")
        await expect(card).toHaveAttribute("href", "https://example.com/")
        await expect(card).toHaveAttribute("target", "_blank")
    })

    test("[entry-detail/3.2] 動画と引用を持つ投稿に、動画の表示と、引用元の作者と本文を持ちBlueskyの引用元を開く枠が表示される", async ({
        page,
    }) => {
        await page.goto("/entries/sample/")
        const item = page.locator("li", { hasText: "スレッド5件目" })
        const quote = item.getByTestId("post-quote")
        await expect(quote).toBeVisible()
        await expect(quote).toContainText("引用元のユーザー")
        await expect(quote).toContainText("@other.demo")
        await expect(quote).toContainText("引用元の投稿のサンプルです。")
        const open = quote.getByRole("link", {
            name: "Blueskyで引用元の投稿を開く",
        })
        await expect(open).toHaveAttribute(
            "href",
            "https://bsky.app/profile/other.demo/post/quotedsample",
        )
        await expect(open).toHaveAttribute("target", "_blank")
        // 引用の枠の上に、動画（利用不可の表示）がある
        const quoteBox = (await quote.boundingBox())!
        const videoBox = (await item
            .getByTestId("video-unavailable")
            .boundingBox())!
        expect(videoBox.y).toBeLessThan(quoteBox.y)
    })
})
