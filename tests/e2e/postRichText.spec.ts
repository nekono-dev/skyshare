/**
 * 投稿本文のリンク表示（`specs/post-rich-text`）のヘッドレスブラウザによる動作確認。
 *
 * 責務と処理概要:
 * - `/?guest` のタイムラインの `guest-rich-text` 投稿と、`/entries/sample/` の6件目の投稿で、
 *   メンション・ハッシュタグ・URLがそれぞれの遷移先を新しいタブで開くリンクになることを検証する。
 * - `/entries/sample/` の説明文のスキームを省略した URL が、https を補ったリンクになることを検証する。
 * - JavaScript を無効にした entry 詳細ページでもリンクが表示されることを検証する。
 */
import { expect, test } from "./fixtures"
import { type Locator } from "@playwright/test"

const RICH_TEXT_POST = "ハッシュタグ・メンション・URLを含む投稿の表示です。"
const SAMPLE_LINK_POST = "スレッド6件目（末尾投稿）です。"

/** 本文中のリンク3種の遷移先と、新しいタブで開く指定を確かめる */
const expectBodyLinks = async (scope: Locator) => {
    const tag = scope.getByRole("link", { name: "#skyshare" })
    const mention = scope.getByRole("link", { name: "@guest.demo" })
    const url = scope.getByRole("link", { name: "https://example.com/" })
    await expect(tag).toHaveAttribute(
        "href",
        "https://bsky.app/hashtag/skyshare",
    )
    await expect(mention).toHaveAttribute(
        "href",
        "https://bsky.app/profile/did:plc:guestdemo",
    )
    await expect(url).toHaveAttribute("href", "https://example.com/")
    for (const link of [tag, mention, url]) {
        await expect(link).toHaveAttribute("target", "_blank")
        await expect(link).toHaveAttribute("rel", "noopener noreferrer")
    }
}

test.describe("投稿本文のリンク表示", () => {
    test("[post-rich-text/AC-1 post-rich-text/AC-2] タイムラインの本文のメンション・ハッシュタグ・URLが新しいタブで開くリンクになり、前後の文字は元のまま", async ({
        page,
    }) => {
        await page.goto("/?guest")
        const card = page.locator("article", { hasText: RICH_TEXT_POST })
        await expect(card).toBeVisible({ timeout: 30_000 })
        await expectBodyLinks(card)
        await expect(
            card.locator("p").filter({ hasText: RICH_TEXT_POST }),
        ).toHaveText(
            `${RICH_TEXT_POST} #skyshare @guest.demo https://example.com/`,
        )
    })

    test("[post-rich-text/AC-1] entry詳細ページの本文のメンション・ハッシュタグ・URLがリンクになる", async ({
        page,
    }) => {
        await page.goto("/entries/sample/")
        await expectBodyLinks(page.locator("li", { hasText: SAMPLE_LINK_POST }))
    })

    test("[post-rich-text/AC-9] entry詳細ページの説明文のスキームを省略したURLが、httpsを補ったリンクになる", async ({
        page,
    }) => {
        await page.goto("/entries/sample/")
        const link = page.getByRole("link", { name: "example.com/sample" })
        await expect(link).toHaveAttribute("href", "https://example.com/sample")
        await expect(link).toHaveAttribute("target", "_blank")
        await expect(link).toHaveAttribute("rel", "noopener noreferrer")
    })
})

test.describe("JavaScript無効", () => {
    test.use({ javaScriptEnabled: false })

    test("[post-rich-text/AC-6] JavaScriptを無効にしたentry詳細ページで、本文のリンクが表示される", async ({
        page,
    }) => {
        await page.goto("/entries/sample/")
        await expectBodyLinks(page.locator("li", { hasText: SAMPLE_LINK_POST }))
    })
})
