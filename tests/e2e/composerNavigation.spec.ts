/**
 * 投稿フォームの遷移の確認と、予約投稿が無効のときの設定への案内のヘッドレスブラウザによる確認。
 *
 * 責務と処理概要:
 * - 作成中にフッターの設定を押すと、遷移を止めて下書き保存の3択を出すことを検証する。
 * - 予約投稿が無効のときにカレンダーのボタンを押すと、設定への案内が出ることを検証する。
 * - 認証情報の入力が、スマホ幅で画面の上部に固定されることを検証する。
 */
import type { Page } from "@playwright/test"
import { expect, test } from "./fixtures"
import { mockScheduleApi } from "./scheduleMocks"

/** 下書きの保存の呼び出しを記録し、成功を返す */
const mockDraftSave = async (page: Page) => {
    const saves: unknown[] = []
    await page.route(/\/v2\/bsky\/drafts\/?$/, async route => {
        const request = route.request()
        if (request.method() === "POST") {
            saves.push(request.postDataJSON())
            return route.fulfill({
                status: 200,
                contentType: "application/json",
                body: JSON.stringify({ id: "d1" }),
            })
        }
        return route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({ drafts: [] }),
        })
    })
    return saves
}

const typeBody = async (page: Page, text: string) => {
    const editor = page.locator("[data-post-body-editor]").first()
    await expect(editor).toBeVisible({ timeout: 60_000 })
    await expect(async () => {
        await editor.click()
        await page.keyboard.type(text)
        await expect(editor).toContainText(text, { timeout: 2_000 })
    }).toPass({ timeout: 20_000 })
}

const confirmDialog = (page: Page) =>
    page.getByRole("dialog", { name: "下書き保存確認" })

/** フッターの設定のリンク（スマホ幅）を押す */
const clickSettingsLink = (page: Page) =>
    page.locator('[data-nav="footer"] a[data-nav-key="settings"]').click()

test.use({ viewport: { width: 390, height: 844 } })

test("[composer-navigation/1.1 composer-navigation/1.5] 本文を入力して設定を押すと3択の確認が出て、住所は変わらず、保存を選ぶと保存が1回呼ばれて設定へ移る", async ({
    page,
}) => {
    test.setTimeout(90_000)
    await mockScheduleApi(page)
    const saves = await mockDraftSave(page)
    await page.goto("/post/")
    await typeBody(page, "作成中の本文")
    await clickSettingsLink(page)
    const dialog = confirmDialog(page)
    await expect(dialog).toBeVisible()
    for (const name of ["下書きを保存", "破棄", "編集を続ける"]) {
        await expect(dialog.getByRole("button", { name })).toBeVisible()
    }
    // 確認の間は、ページの住所が変わらない
    expect(new URL(page.url()).pathname).toBe("/post/")

    await dialog.getByRole("button", { name: "下書きを保存" }).click()
    await expect(page).toHaveURL(/\/settings\/$/)
    expect(saves).toHaveLength(1)
})

test("[composer-navigation/1.2,1.3] 破棄は保存を呼ばずに設定へ移り、編集を続けるは移らず本文が残る", async ({
    page,
}) => {
    test.setTimeout(90_000)
    await mockScheduleApi(page)
    const saves = await mockDraftSave(page)
    await page.goto("/post/")
    await typeBody(page, "残る本文")
    await clickSettingsLink(page)
    await confirmDialog(page)
        .getByRole("button", { name: "編集を続ける" })
        .click()
    await expect(confirmDialog(page)).toBeHidden()
    expect(new URL(page.url()).pathname).toBe("/post/")
    await expect(page.locator("[data-post-body-editor]").first()).toContainText(
        "残る本文",
    )

    await clickSettingsLink(page)
    await confirmDialog(page).getByRole("button", { name: "破棄" }).click()
    await expect(page).toHaveURL(/\/settings\/$/)
    expect(saves).toHaveLength(0)
})

test("[composer-navigation/1.4] 本文が空のときは、確認が出ずに設定へ移る", async ({
    page,
}) => {
    test.setTimeout(90_000)
    await mockScheduleApi(page)
    await page.goto("/post/")
    await expect(page.locator("[data-post-body-editor]").first()).toBeVisible({
        timeout: 60_000,
    })
    await clickSettingsLink(page)
    await expect(page).toHaveURL(/\/settings\/$/)
    await expect(confirmDialog(page)).toHaveCount(0)
})

test("[composer-navigation/2.1 composer-navigation/2.2] 予約投稿が無効のときカレンダーを押すと案内が出て、設定を開くと、本文があれば確認を挟んで設定へ移る", async ({
    page,
}) => {
    test.setTimeout(90_000)
    await mockScheduleApi(page, { registered: false })
    await mockDraftSave(page)
    await page.goto("/post/")
    const picker = page.getByTestId("schedule-picker-button")
    // 無効の表示のまま、押せる
    await expect(picker).toHaveAttribute("aria-disabled", "true", {
        timeout: 60_000,
    })
    // disabled 属性は無く、押せる（toBeEnabled は aria-disabled も無効と見なすため使わない）
    await expect(picker).not.toHaveAttribute("disabled", /.*/)
    await picker.click({ force: true })
    const guide = page.getByRole("dialog", {
        name: "予約投稿を有効にしていません",
    })
    await expect(guide).toBeVisible()
    await guide.getByRole("button", { name: "設定を開く" }).click()
    await expect(page).toHaveURL(/\/settings\/$/)

    // 本文があるときは、移る前に確認が出る
    await page.goto("/post/")
    await typeBody(page, "案内の前の本文")
    await expect(picker).toHaveAttribute("aria-disabled", "true")
    await picker.click({ force: true })
    await page
        .getByRole("dialog", { name: "予約投稿を有効にしていません" })
        .getByRole("button", { name: "設定を開く" })
        .click()
    await expect(confirmDialog(page)).toBeVisible()
    expect(new URL(page.url()).pathname).toBe("/post/")
})

test("[schedule-form/2.4] 画面幅390で認証情報の入力を開くと、ダイアログの上端が画面の上部にあり、全体が画面に収まる", async ({
    page,
}) => {
    test.setTimeout(90_000)
    await mockScheduleApi(page, { registered: false })
    await page.goto("/settings/")
    const toggle = page.getByRole("switch", { name: "予約投稿" })
    await expect(toggle).toBeVisible({ timeout: 60_000 })
    await toggle.click({ force: true })
    const dialog = page.getByTestId("schedule-credential-dialog")
    await expect(dialog).toBeVisible()
    const box = (await dialog.boundingBox())!
    expect(box.y).toBeLessThan(24)
    expect(box.y + box.height).toBeLessThanOrEqual(844)
})
