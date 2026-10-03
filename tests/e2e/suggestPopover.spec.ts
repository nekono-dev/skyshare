/**
 * `@`/`#` 候補フローティング（SuggestPopover）のヘッドレスブラウザによる回帰確認。
 *
 * 責務と処理概要:
 * - 選択肢行を共通部品 `ListboxOption` へ移行した後も、ハイライト・キーボード移動・
 *   mousedown確定・フォーカス維持・Escでの消去が従来どおり動くことを検証する。
 * - トレンド取得（`getTrendingTopics`）はネットワークに依存しないようモックする。
 */
import { expect, test } from "@playwright/test"

test("# 候補: ハイライト移動・クリック確定・Escで閉じる", async ({ page }) => {
    test.setTimeout(90_000)
    await page.route("**/app.bsky.unspecced.getTrendingTopics**", route =>
        route.fulfill({
            contentType: "application/json",
            headers: { "access-control-allow-origin": "*" },
            body: JSON.stringify({
                topics: [
                    { topic: "alpha", link: "/search?q=alpha" },
                    { topic: "alpine", link: "/search?q=alpine" },
                ],
                suggested: [{ topic: "alps", link: "/search?q=alps" }],
            }),
        }),
    )
    await page.goto("/post/?guest", { timeout: 60_000 })
    const editor = page.locator('[contenteditable="true"]').first()
    await expect(editor).toBeVisible({ timeout: 60_000 })

    const options = page.getByRole("option")
    await expect(async () => {
        await editor.click()
        await page.keyboard.press("Control+A")
        await page.keyboard.press("Backspace")
        await editor.pressSequentially("#al")
        await expect(options.first()).toBeVisible({ timeout: 2_000 })
    }).toPass({ timeout: 20_000 })

    // 1. 1件目がハイライトされている
    await expect(options.nth(0)).toHaveAttribute("aria-selected", "true")
    // 2. ↓で2件目へ移る
    await page.keyboard.press("ArrowDown")
    await expect(options.nth(1)).toHaveAttribute("aria-selected", "true")
    await expect(options.nth(0)).toHaveAttribute("aria-selected", "false")

    // 3. クリックで挿入され、本文欄がフォーカスを保持する
    await options.nth(1).click()
    await expect(editor).toContainText("#alpine")
    await expect(editor).toBeFocused()
    await expect(options).toHaveCount(0)

    // 4. Escで閉じる
    await editor.pressSequentially(" #al")
    await expect(options.first()).toBeVisible()
    await page.keyboard.press("Escape")
    await expect(options).toHaveCount(0)
})
