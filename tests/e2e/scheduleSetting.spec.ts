/**
 * 設定の予約投稿のスイッチ（ScheduleSetting・CredentialDialog）のヘッドレスブラウザによる確認。
 *
 * 責務と処理概要:
 * - 予約・認証情報の API を差し替え、スイッチの表示・有効化の入力・無効化の確認・
 *   認証情報の入力の文言とフォームの構成・狭い画面での収まりを検証する。
 */
import { expect, test } from "./fixtures"
import type { Page } from "@playwright/test"
import { mockScheduleApi, type ScheduleItem } from "./scheduleMocks"

const pending = (id: string): ScheduleItem => ({
    id,
    runAt: "2027-03-01T10:00:00.000Z",
    status: "pending",
    postCount: 1,
    preview: `本文-${id}`,
    lastError: null,
})

const scheduleSwitch = (page: Page) =>
    page.getByRole("switch", { name: "予約投稿" })

test("[schedule-form/AC-1] 登録済みならオンで表示され、未登録でオンにすると入力が現れ、取り消すとオフのまま", async ({
    page,
}) => {
    test.setTimeout(90_000)
    const { state } = await mockScheduleApi(page, { registered: true })
    await page.goto("/settings/")
    await expect(scheduleSwitch(page)).toBeChecked({ timeout: 30_000 })

    state.registered = false
    await page.reload()
    const toggle = scheduleSwitch(page)
    await expect(toggle).not.toBeChecked({ timeout: 30_000 })
    await expect(toggle).toBeEnabled()
    await toggle.click({ force: true })
    const dialog = page.getByTestId("schedule-credential-dialog")
    await expect(dialog.getByRole("heading")).toHaveText("予約投稿を有効にする")
    await dialog.getByRole("button", { name: "キャンセル" }).click()
    await expect(dialog.locator("form")).toHaveCount(0)
    await expect(toggle).not.toBeChecked()
})

test("[schedule-form/AC-2 schedule-form/AC-4 schedule-form/AC-21] 入力に注意と作成場所とリンクがあり、登録に成功するとオンになる", async ({
    page,
}) => {
    test.setTimeout(90_000)
    const { calls } = await mockScheduleApi(page, { registered: false })
    await page.goto("/settings/")
    const toggle = scheduleSwitch(page)
    await expect(toggle).toBeEnabled({ timeout: 30_000 })
    await toggle.click({ force: true })
    const dialog = page.getByTestId("schedule-credential-dialog")
    await expect(
        dialog.getByText("メインのパスワードではなく、アプリパスワード"),
    ).toBeVisible()
    await expect(dialog.getByText("プライバシーとセキュリティ")).toBeVisible()
    await expect(
        dialog.getByRole("link", { name: "プライバシーポリシー" }),
    ).toHaveAttribute("href", "/privacy/#collected")
    // 可視のユーザー名欄と、現在のパスワードとして扱う欄が、同じフォームにある
    const form = dialog.locator("form")
    const username = form.locator('input[autocomplete="username"]')
    const password = form.locator('input[autocomplete="current-password"]')
    await expect(username).toBeVisible()
    await expect(username).toHaveValue("me.bsky.social")
    await expect(password).toBeVisible()
    await expect(form.locator('input[type="text"]')).toHaveCount(1)

    await password.fill("abcd-efgh-ijkl-mnop")
    await dialog.getByRole("button", { name: "登録する" }).click()
    await expect(toggle).toBeChecked()
    await expect(dialog.locator("form")).toHaveCount(0)
    expect(calls.credentialPuts).toEqual([{ password: "abcd-efgh-ijkl-mnop" }])
})

test("[schedule-form/AC-3] 待機中が2件のときオフにすると2件の確認が出て、拒否するとオン、承諾するとオフになる", async ({
    page,
}) => {
    test.setTimeout(90_000)
    const { calls } = await mockScheduleApi(page, {
        registered: true,
        items: [pending("a"), pending("b")],
    })
    await page.goto("/settings/")
    const toggle = scheduleSwitch(page)
    await expect(toggle).toBeChecked({ timeout: 30_000 })

    await toggle.click({ force: true })
    const confirm = page.getByRole("dialog", { name: "予約投稿を無効にする" })
    await expect(
        confirm.getByText("待機中の予約2件も取り消されます"),
    ).toBeVisible()
    await confirm.getByRole("button", { name: "キャンセル" }).click()
    await expect(toggle).toBeChecked()
    expect(calls.credentialDeletes).toBe(0)

    await toggle.click({ force: true })
    await confirm.getByRole("button", { name: "無効にする" }).click()
    await expect(toggle).not.toBeChecked()
    await expect(page.getByText("2件の予約を取り消しました")).toBeVisible()
    expect(calls.credentialDeletes).toBe(1)
})

test.describe("狭い画面", () => {
    test.use({ viewport: { width: 390, height: 664 } })

    test("[schedule-form/AC-23] 幅390・高さ664の画面で、認証情報の入力の全体が画面の内側に収まる", async ({
        page,
    }) => {
        test.setTimeout(90_000)
        await mockScheduleApi(page, { registered: false })
        await page.goto("/settings/")
        const toggle = scheduleSwitch(page)
        await expect(toggle).toBeEnabled({ timeout: 30_000 })
        await toggle.click({ force: true })
        const dialog = page.getByTestId("schedule-credential-dialog")
        await expect(dialog.locator("form")).toBeVisible()
        const box = (await dialog.boundingBox())!
        expect(box.x).toBeGreaterThanOrEqual(0)
        expect(box.y).toBeGreaterThanOrEqual(0)
        expect(box.x + box.width).toBeLessThanOrEqual(390)
        expect(box.y + box.height).toBeLessThanOrEqual(664)
        // ダイアログの中身がはみ出して横に流れない
        const overflow = await dialog.evaluate(
            el => el.scrollWidth - el.clientWidth,
        )
        expect(overflow).toBeLessThanOrEqual(0)
    })
})
