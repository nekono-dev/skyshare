/**
 * 設定ページの表示テーマの切り替えのヘッドレスブラウザによる確認。
 *
 * 責務と処理概要:
 * - 表示テーマをダークに切り替えると、文書の data-theme 属性が dark になり、
 *   再読み込み後も保持されることを検証する。
 * - ログイン不要のゲスト表示（`?guest`）を使う。
 */
import { expect, test } from "@playwright/test"

test("[app-settings/1.4] 表示テーマをダークに切り替えると、data-theme が dark になり再読み込み後も保たれる", async ({
    page,
}) => {
    test.setTimeout(90_000)
    await page.goto("/settings/?guest", { timeout: 60_000 })
    const select = page.getByRole("combobox", { name: "表示テーマ" })
    await expect(select).toBeVisible({ timeout: 60_000 })
    // ハイドレーション前のクリックは無視されるため、一覧が開くまで繰り返す
    const dark = page.getByRole("option", { name: "ダーク" })
    await expect(async () => {
        await select.click()
        await expect(dark).toBeVisible({ timeout: 2_000 })
    }).toPass({ timeout: 20_000 })
    await dark.click()
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark")

    await page.reload()
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark")
})
