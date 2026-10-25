/**
 * 設定ページのヘッドレスブラウザによる確認。
 *
 * 責務と処理概要:
 * - 設定ページが「表示」「投稿フォーム」「返信可否」の3つのグループを見出し付きで
 *   表示することを検証する。
 * - ログイン不要のゲスト表示（`?guest`）を使う。
 */
import { expect, test } from "@playwright/test"

test("[app-settings/AC-12] ゲスト表示の設定ページに、3つのグループの見出しが表示される", async ({
    page,
}) => {
    test.setTimeout(90_000)
    await page.goto("/settings/?guest", { timeout: 60_000 })
    for (const name of ["表示", "投稿フォーム", "返信"]) {
        await expect(
            page.getByRole("heading", { level: 2, name: new RegExp(name) }),
        ).toBeVisible({ timeout: 60_000 })
    }
})
