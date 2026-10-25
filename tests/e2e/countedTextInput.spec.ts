/**
 * 文字数カウンタ付きの入力欄（CountedTextInput）のヘッドレスブラウザによる確認。
 *
 * 責務と処理概要:
 * - 設定ページのMastodonインスタンス欄（1行の入力欄）に入力した値が、
 *   入力欄へ反映されることを検証する。
 * - ログイン不要のゲスト表示（`?guest`）を使う。
 */
import { expect, test } from "@playwright/test"

test("[counted-text-input/AC-8] 設定ページの1行の入力欄へ入力した値が反映される", async ({
    page,
}) => {
    test.setTimeout(90_000)
    await page.goto("/settings/?guest", { timeout: 60_000 })
    const input = page.locator('input[type="text"][id$="-text"]').first()
    await expect(input).toBeVisible({ timeout: 60_000 })
    await input.fill("example.social")
    await expect(input).toHaveValue("example.social")
})
