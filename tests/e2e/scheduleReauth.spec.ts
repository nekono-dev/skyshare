/**
 * 予約投稿の許可が無効になったときの再度の許可と、許可の有効期限の目安のヘッドレスブラウザによる確認。
 *
 * 責務と処理概要:
 * - 予約の API を差し替え、設定の再度の許可の案内・投稿フォームからの再度の許可と移る前の確認・
 *   日時の指定の有効期限の目安・許可を始めたページへの戻りを検証する。
 */
import { expect, test } from "./fixtures"
import type { Page } from "@playwright/test"
import { mockScheduleApi, type ScheduleItem } from "./scheduleMocks"

const editor = (page: Page) => page.locator("[data-post-body-editor]").first()

const typeBody = async (page: Page, text: string) => {
    const box = editor(page)
    await expect(box).toBeVisible({ timeout: 60_000 })
    await expect(async () => {
        await box.click()
        await page.keyboard.press("Control+A")
        await page.keyboard.press("Backspace")
        await box.pressSequentially(text)
        await expect(box).toContainText(text, { timeout: 2_000 })
    }).toPass({ timeout: 20_000 })
}

const reauthDialog = (page: Page) =>
    page.getByRole("dialog", { name: "予約投稿を有効にする" })

/** 認可の画面への遷移を受け止め、移ったことを記録する */
const catchAuthorize = async (page: Page) => {
    const visits: string[] = []
    await page.route("https://auth.example/**", route => {
        visits.push(route.request().url())
        return route.fulfill({
            status: 200,
            contentType: "text/html",
            body: "<p>authorize</p>",
        })
    })
    return visits
}

/** 押せない見た目のカレンダーのボタンを押して、再度の許可のダイアログを開く */
const openReauthFromCalendar = async (page: Page) => {
    const button = page.getByTestId("schedule-picker-button")
    await expect(button).toHaveAttribute(
        "title",
        "Bluesky での許可が無効になりました。押すと、もう一度許可できます。",
        { timeout: 30_000 },
    )
    await expect(async () => {
        await button.click({ force: true })
        await expect(reauthDialog(page)).toBeVisible({ timeout: 2_000 })
    }).toPass({ timeout: 20_000 })
    return reauthDialog(page)
}

test("[schedule-form/AC-30] 許可が無効になってもスイッチはオンのまま再度の許可が案内され、ボタンで再度の許可のダイアログが開く", async ({
    page,
}) => {
    test.setTimeout(90_000)
    const { calls } = await mockScheduleApi(page, { reauthRequired: true })
    await page.goto("/settings/")
    await expect(page.getByRole("switch", { name: "予約投稿" })).toBeChecked({
        timeout: 30_000,
    })
    const notice = page.getByTestId("schedule-reauth")
    await expect(notice).toContainText("Bluesky での許可が無効になっています")
    await notice.getByRole("button", { name: "もう一度許可する" }).click()
    const dialog = reauthDialog(page)
    await expect(dialog).toBeVisible()
    await catchAuthorize(page)
    await dialog.getByRole("button", { name: "認証する" }).click()
    await expect.poll(() => calls.authorizationStarts).toBe(1)
    expect(calls.authorizationStartBodies[0]).toEqual({
        returnTo: "/settings/",
    })
})

test("[schedule-form/AC-31] 投稿フォームで許可が無効なら、カレンダーから再度の許可を開け、作成中の内容があれば移る前に下書きの確認が出る", async ({
    page,
}) => {
    test.setTimeout(90_000)
    const { calls } = await mockScheduleApi(page, { reauthRequired: true })
    const visits = await catchAuthorize(page)
    await page.goto("/post/")
    await typeBody(page, "作成中の本文")
    const dialog = await openReauthFromCalendar(page)
    await dialog.getByRole("button", { name: "認証する" }).click()

    // 移る前に下書きの確認が出て、編集を続けると移らず本文が残る
    const confirm = page.getByRole("dialog", { name: "下書き保存確認" })
    await expect(confirm).toBeVisible()
    await confirm.getByRole("button", { name: "編集を続ける" }).click()
    await expect(confirm).toBeHidden()
    expect(visits).toHaveLength(0)
    await expect(editor(page)).toContainText("作成中の本文")
    expect(calls.authorizationStartBodies[0]).toEqual({ returnTo: "/post/" })

    // もう一度許可を選び、破棄を選ぶと認可の画面へ移る
    const again = await openReauthFromCalendar(page)
    await again.getByRole("button", { name: "認証する" }).click()
    await confirm.getByRole("button", { name: "破棄" }).click()
    await expect.poll(() => visits.length).toBe(1)
})

const tomorrow = () => new Date(Date.now() + 86400_000).toISOString()

const pendingItem: ScheduleItem = {
    id: "s1",
    runAt: "2027-03-01T10:00:00.000Z",
    status: "pending",
    postCount: 1,
    preview: "編集中の予約",
    lastError: null,
}

test("[schedule-form/AC-32] 予約の編集中に再度の許可へ進むと、移る前に予約の編集をやめる3択が出る", async ({
    page,
}) => {
    test.setTimeout(90_000)
    await mockScheduleApi(page, {
        reauthRequired: true,
        items: [pendingItem],
        details: {
            s1: {
                id: "s1",
                runAt: tomorrow(),
                posts: [{ text: "編集中の予約", langs: ["ja"] }],
                createEntry: false,
            },
        },
    })
    const visits = await catchAuthorize(page)
    await page.goto("/post/")
    const open = page.getByRole("button", { name: "下書き・予約", exact: true })
    await expect(open).toBeEnabled({ timeout: 60_000 })
    await expect(async () => {
        await open.click()
        await expect(page.getByRole("tab", { name: "予約" })).toBeVisible({
            timeout: 2_000,
        })
    }).toPass({ timeout: 20_000 })
    await page.getByRole("tab", { name: "予約" }).click()
    await page
        .getByTestId("schedule-list")
        .getByRole("button", { name: /編集中の予約/ })
        .click()
    await expect(editor(page)).toContainText("編集中の予約")

    // 実行日時の行から再度の許可を開く
    await page.getByTestId("schedule-run-at-label").click()
    const dialog = reauthDialog(page)
    await expect(dialog).toBeVisible()
    await dialog.getByRole("button", { name: "認証する" }).click()
    const choice = page.getByRole("dialog", { name: "予約の編集をやめます" })
    await expect(
        choice.getByRole("button", { name: "予約を取り消す" }),
    ).toBeVisible()
    await choice.getByRole("button", { name: "編集を続ける" }).click()
    expect(visits).toHaveLength(0)
    await expect(editor(page)).toContainText("編集中の予約")

    await page.getByTestId("schedule-run-at-label").click()
    await reauthDialog(page).getByRole("button", { name: "認証する" }).click()
    await choice.getByRole("button", { name: "予約を残して閉じる" }).click()
    await expect.poll(() => visits.length).toBe(1)
})

test.describe("東京の端末", () => {
    test.use({ timezoneId: "Asia/Tokyo" })

    test("[schedule-form/AC-33] 日時の指定に、許可の有効期限の目安が予約するたびに延びる旨とともに示される", async ({
        page,
    }) => {
        test.setTimeout(90_000)
        await mockScheduleApi(page, { expiresAt: "2027-03-01T03:00:00.000Z" })
        await page.goto("/post/")
        await typeBody(page, "本文")
        const button = page.getByTestId("schedule-picker-button")
        await expect(button).toBeEnabled({ timeout: 30_000 })
        const picker = page.getByRole("dialog", { name: "予約日時" })
        await expect(async () => {
            await button.click()
            await expect(picker).toBeVisible({ timeout: 2_000 })
        }).toPass({ timeout: 20_000 })
        await expect(picker.getByTestId("schedule-expiry")).toHaveText(
            "許可の有効期限の目安: 2027/3/1（予約するたびに延びます）",
        )
    })
})

test("[schedule-form/AC-34] 許可を始めた投稿フォームのページに戻ると、完了が呼ばれて結果が表示され、戻りの項目が住所から消える", async ({
    page,
}) => {
    test.setTimeout(90_000)
    const { calls } = await mockScheduleApi(page, { reauthRequired: true })
    await page.goto("/post/#oauthReturn=schedule&code=C&state=S")
    await expect(page.getByText("予約投稿を有効にしました。")).toBeVisible({
        timeout: 30_000,
    })
    expect(calls.authorizationCompletions).toEqual([{ code: "C", state: "S" }])
    expect(new URL(page.url()).hash).toBe("")
    // 再度の許可が済むと、カレンダーのボタンが押せる
    await page
        .getByRole("dialog", { name: "Bluesky での予約投稿の許可" })
        .getByRole("button", { name: "閉じる" })
        .click()
    await typeBody(page, "本文")
    await expect(page.getByTestId("schedule-picker-button")).toBeEnabled({
        timeout: 30_000,
    })
})
