/**
 * プライバシーポリシーページ（PolicyCards）のヘッドレスブラウザによる確認。
 *
 * 責務と処理概要:
 * - ログインなしで開けて、節の見出しがカードごとに表示されることを検証する。
 */
import { expect, test } from "@playwright/test"

test("[privacy-policy/AC-7] ログインなしでページを開くと、節の見出しがカードごとに表示される", async ({
    page,
}) => {
    await page.goto("/privacy/")
    await expect(
        page.getByRole("heading", { name: "プライバシーポリシー", level: 1 }),
    ).toBeVisible()
    await expect(
        page.getByRole("heading", { name: "第1条（運営者と窓口）" }),
    ).toBeVisible()
    await expect(
        page.getByRole("heading", {
            name: "第4条（第三者への提供）",
        }),
    ).toBeVisible()
    // 窓口のメールアドレスは運用者ごとの設定で変わるため、形式だけを確かめる
    await expect(
        page.getByText(/[^\s@]+@[^\s@]+\.[^\s@]+/).first(),
    ).toBeVisible()
})
