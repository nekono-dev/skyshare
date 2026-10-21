/**
 * 投稿本文の編集欄（PostBodyEditor）のヘッドレスブラウザによる確認。
 *
 * 責務と処理概要:
 * - ハッシュタグの入力が編集欄の中で色付けされた要素（span）になること、
 *   Enterで改行が入り入力済みの本文が残ることを検証する。
 * - ログイン不要のゲスト表示（`?guest`）を使う。
 */
import { expect, test } from "@playwright/test"

const openEditor = async (page: import("@playwright/test").Page) => {
    await page.goto("/post/?guest", { timeout: 60_000 })
    const editor = page.locator("[data-post-body-editor]").first()
    await expect(editor).toBeVisible({ timeout: 60_000 })
    return editor
}

test("[post-body-editor/AC-15] 編集欄へ #tag と入力すると、その範囲が色付けされた要素になる", async ({
    page,
}) => {
    test.setTimeout(90_000)
    const editor = await openEditor(page)
    await expect(async () => {
        await editor.click()
        await page.keyboard.press("Control+A")
        await page.keyboard.press("Backspace")
        await editor.pressSequentially("hello #tag")
        await expect(editor.locator("span")).toHaveCount(1, { timeout: 2_000 })
    }).toPass({ timeout: 20_000 })
    await expect(editor.locator("span").first()).toHaveText("#tag")
})

test("[post-body-editor/AC-16] 本文を入力した後に Enter を押すと、改行が入り入力済みの本文が残る", async ({
    page,
}) => {
    test.setTimeout(90_000)
    const editor = await openEditor(page)
    await expect(async () => {
        await editor.click()
        await page.keyboard.press("Control+A")
        await page.keyboard.press("Backspace")
        await editor.pressSequentially("first")
        await page.keyboard.press("Enter")
        await editor.pressSequentially("second")
        await expect(editor.locator("br").first()).toBeAttached({
            timeout: 2_000,
        })
    }).toPass({ timeout: 20_000 })
    await expect(editor).toContainText("first")
    await expect(editor).toContainText("second")
})
