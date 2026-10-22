/**
 * プライバシーポリシーページ（PolicyCards）のヘッドレスブラウザによる確認。
 *
 * 責務と処理概要:
 * - ログインなしで開けて、節の見出しがカードごとに表示され、連絡先がリンクになることを検証する。
 */
import { expect, test } from "@playwright/test"

test("[privacy-policy/AC-7] ログインなしでページを開くと、節の見出しがカードごとに表示され、連絡先がリンクになる", async ({
    page,
}) => {
    await page.goto("/privacy/")
    await expect(
        page.getByRole("heading", { name: "プライバシーポリシー", level: 1 }),
    ).toBeVisible()
    await expect(
        page.getByRole("heading", { name: "運営者と連絡先" }),
    ).toBeVisible()
    await expect(
        page.getByRole("heading", { name: "情報の共有" }),
    ).toBeVisible()
    // 窓口のメールアドレスは運用者ごとの設定で変わるため、形式だけを確かめる
    const contact = page.locator("#operator")
    await expect(contact.locator('a[href^="mailto:"]')).toHaveText(
        /[^\s@]+@[^\s@]+\.[^\s@]+/,
    )
})
