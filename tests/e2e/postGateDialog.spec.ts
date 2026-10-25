/**
 * 返信・引用の設定ダイアログ（PostGateDialog）のヘッドレスブラウザによる確認。
 *
 * 責務と処理概要:
 * - 設定ページの「返信・引用のデフォルト設定を編集」からダイアログを開き、
 *   返信不可を選んで適用すると既定値として保存されること、
 *   キャンセルでは保存されないことを検証する。
 * - ログイン不要のゲスト表示（`?guest`）を使う。
 */
import { expect, test, type Page } from "@playwright/test"

const openGateDialog = async (page: Page) => {
    await page.goto("/settings/?guest", { timeout: 60_000 })
    const edit = page.getByRole("button", {
        name: "返信・引用のデフォルト設定を編集",
    })
    const dialog = page.getByRole("dialog", { name: "返信・引用の設定" })
    // ハイドレーション前のクリックは無視されるため、ダイアログが開くまで繰り返す
    await expect(async () => {
        await edit.click()
        await expect(dialog).toBeVisible({ timeout: 2_000 })
    }).toPass({ timeout: 30_000 })
    return dialog
}

const readSavedGate = (page: Page) =>
    page.evaluate(() => window.localStorage.getItem("postGateDefault"))

test("[post-gate/AC-12] 返信不可を選んで適用すると、既定値として保存される", async ({
    page,
}) => {
    test.setTimeout(90_000)
    const dialog = await openGateDialog(page)
    await dialog.getByText("返信不可").click()
    await dialog.getByRole("button", { name: "適用" }).click()
    await expect(dialog).toBeHidden()
    const saved = await readSavedGate(page)
    expect(JSON.parse(saved ?? "{}")).toMatchObject({ replyAudience: "nobody" })
})

test("[post-gate/AC-13] キャンセルすると、変更は保存されない", async ({
    page,
}) => {
    test.setTimeout(90_000)
    const dialog = await openGateDialog(page)
    await dialog.getByText("返信不可").click()
    await dialog.getByRole("button", { name: "キャンセル" }).click()
    await expect(dialog).toBeHidden()
    expect(await readSavedGate(page)).toBeNull()
})
