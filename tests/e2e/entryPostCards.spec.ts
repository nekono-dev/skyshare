/**
 * Entry詳細ページの投稿カード表示（.kiro/specs/entry-detail）の
 * ヘッドレスブラウザによる動作確認。`entries/sample` の固定サンプルページを使う。
 */
import { expect, test } from "./fixtures"

test.describe("Entry詳細ページの投稿カード", () => {
    test("[entry-detail/1.1 entry-detail/1.4 entry-detail/2.3] スレッドサンプル: 6カードが順に並び、連結線があり、リアクションは各カード別", async ({
        page,
    }) => {
        await page.goto("/entries/sample/")
        const items = page.locator("ol > li")
        await expect(items).toHaveCount(6)
        const ys = await Promise.all(
            [0, 1, 2].map(async i => (await items.nth(i).boundingBox())!.y),
        )
        expect(ys[0]).toBeLessThan(ys[1])
        expect(ys[1]).toBeLessThan(ys[2])
        const after = await items
            .first()
            .evaluate(el => getComputedStyle(el, "::after").width)
        expect(after).toBe("2px")

        const likes = await items.evaluateAll(els =>
            els.map(el => el.querySelector("dl")?.textContent ?? ""),
        )
        expect(new Set(likes).size).toBe(6)
        expect(likes[0]).toContain("11")
        expect(likes[1]).toContain("22")
        expect(likes[2]).toContain("33")
        expect(likes[3]).toContain("44")
        expect(likes[4]).toContain("55")
        expect(likes[5]).toContain("66")
        // ヘッダーカードにはリアクション数が無い
        await expect(
            page.locator("section dl[aria-label='Blueskyでのリアクション数']"),
        ).toHaveCount(0)
    })

    test("[entry-detail/1.3] 各カードの日時リンクは Bluesky を target=_blank で指す", async ({
        page,
    }) => {
        await page.goto("/entries/sample/")
        const link = page
            .locator("ol > li")
            .first()
            .locator("a[href^='https://bsky.app/']")
        await expect(link).toHaveAttribute("target", "_blank")
    })

    test("[entry-detail/1.5] 最後のカード下端からページ下端まで 96px 以上の余白がある", async ({
        page,
    }) => {
        await page.goto("/entries/sample/")
        const last = (await page.locator("ol > li").last().boundingBox())!
        const footer = (await page
            .locator("footer[aria-hidden='true']")
            .boundingBox())!
        // フッターが最後のカードの直下にあり、96px 以上の高さを持つ（スクロール量に依存しない比較）
        expect(footer.height).toBeGreaterThanOrEqual(96)
        expect(footer.y).toBeGreaterThanOrEqual(last.y + last.height - 1)
        await page
            .locator("footer[aria-hidden='true']")
            .scrollIntoViewIfNeeded()
        const remaining = await page.evaluate(
            () =>
                document.documentElement.scrollHeight -
                window.scrollY -
                window.innerHeight,
        )
        expect(remaining).toBeLessThanOrEqual(1)
    })

    test("[entry-detail/5.1] JavaScript 無効でもサムネイルが表示される", async ({
        browser,
    }) => {
        const context = await browser.newContext({
            javaScriptEnabled: false,
            ignoreHTTPSErrors: true,
        })
        const page = await context.newPage()
        await page.goto("https://localhost:4321/entries/sample/")
        await expect(page.locator("ol li img").first()).toBeVisible()
        await context.close()
    })

    test("[entry-detail/5.2] 360px 幅で横スクロールが発生しない", async ({
        page,
    }) => {
        await page.setViewportSize({ width: 360, height: 800 })
        await page.goto("/entries/sample/")
        const overflow = await page.evaluate(
            () =>
                document.documentElement.scrollWidth >
                document.documentElement.clientWidth,
        )
        expect(overflow).toBe(false)
    })
})
