/**
 * ヘルプページ（Help、HelpItem）のヘッドレスブラウザによる確認。
 *
 * 責務と処理概要:
 * - ヘルプページに、記事の数だけカードが見出し付きで表示されることを検証する。
 * - サイドバー・フッターナビのない単独ページで、設定ページへ戻るリンクがあることを検証する。
 */
import { expect, test } from "@playwright/test"

test("[help-page/AC-3] ヘルプページに、記事の見出しがカードごとに表示される", async ({
    page,
}) => {
    await page.goto("/help/")
    const headings = page.getByRole("heading", { level: 2 })
    await expect(headings.first()).toBeVisible()
    await expect(
        page.getByRole("heading", { name: "画像が選択できない" }),
    ).toBeVisible()
})

test("[help-page/AC-4] ヘルプページにサイドバーとフッターナビがなく、設定ページへ戻るリンクがある", async ({
    page,
}) => {
    await page.goto("/help/")
    await expect(
        page.getByRole("heading", { name: "画像が選択できない" }),
    ).toBeVisible()
    await expect(page.locator('nav[data-nav="sidebar"]')).toHaveCount(0)
    await expect(page.locator('nav[data-nav="footer"]')).toHaveCount(0)
    await expect(
        page.getByRole("link", { name: "設定に戻る" }),
    ).toHaveAttribute("href", "/settings/")
})
