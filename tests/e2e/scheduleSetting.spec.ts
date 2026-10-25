/**
 * 設定の予約投稿のスイッチ（ScheduleSetting・CredentialDialog）のヘッドレスブラウザによる確認。
 *
 * 責務と処理概要:
 * - 予約・認可の API を差し替え、スイッチの表示・許可の案内の内容と認可の画面への移動・
 *   認可からの戻りの表示・無効化の確認・狭い画面での収まりを検証する。
 * - 予約できる投稿の注と、Chronosky への案内を検証する。
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

test("[schedule-form/AC-1] 登録済みならオンで表示され、未登録でオンにすると許可の案内が現れ、取り消すとオフのまま", async ({
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
    await expect(dialog).toHaveCount(0)
    await expect(toggle).not.toBeChecked()
})

test("[schedule-form/AC-4 schedule-form/AC-21] 許可の案内に許可の内容とログイン中のアカウントとリンクがあり、ユーザー名とパスワードの欄が無い", async ({
    page,
}) => {
    test.setTimeout(90_000)
    await mockScheduleApi(page, { registered: false })
    await page.goto("/settings/")
    const toggle = scheduleSwitch(page)
    await expect(toggle).toBeEnabled({ timeout: 30_000 })
    await toggle.click({ force: true })
    const dialog = page.getByTestId("schedule-credential-dialog")
    await expect(
        dialog.getByText(
            "Skyshareが予約した日時にBlueskyへ投稿することを許可します。",
        ),
    ).toBeVisible()
    await expect(
        dialog.getByTestId("schedule-credential-account"),
    ).toContainText("@me.bsky.social アカウントの予約機能を有効化します。")
    await expect(
        dialog.getByRole("link", { name: "プライバシーポリシー" }),
    ).toHaveAttribute("href", "/privacy/#collected")
    await expect(dialog.locator("input")).toHaveCount(0)
    await expect(dialog.getByRole("button", { name: "認証する" })).toBeVisible()
})

test("[schedule-form/AC-2] 許可するで認可の開始が1回呼ばれて認可の画面へ移り、戻り先から設定へ戻ると完了が呼ばれてオンになり文言が出る", async ({
    page,
}) => {
    test.setTimeout(90_000)
    const { calls } = await mockScheduleApi(page, { registered: false })
    // 認可の画面は、実際の戻り先（/oauth/callback/）へ項目つきで戻す
    await page.route("https://auth.example/**", route =>
        route.fulfill({
            status: 303,
            headers: {
                location:
                    "https://localhost:4321/oauth/callback/?code=C1&state=S1&iss=https%3A%2F%2Fauth.example&extra=x",
            },
        }),
    )
    await page.goto("/settings/")
    const toggle = scheduleSwitch(page)
    await expect(toggle).toBeEnabled({ timeout: 30_000 })
    await toggle.click({ force: true })
    await page
        .getByTestId("schedule-credential-dialog")
        .getByRole("button", { name: "認証する" })
        .click()
    await expect(page.getByText("予約投稿を有効にしました。")).toBeVisible({
        timeout: 30_000,
    })
    await expect(scheduleSwitch(page)).toBeChecked()
    expect(calls.authorizationStarts).toBe(1)
    // 戻りの項目だけが完了へ送られ、住所からは消える
    expect(calls.authorizationCompletions).toEqual([
        { code: "C1", state: "S1", iss: "https://auth.example" },
    ])
    expect(new URL(page.url()).pathname).toBe("/settings/")
    expect(new URL(page.url()).hash).toBe("")
    expect(new URL(page.url()).search).toBe("")
})

test("[schedule-form/AC-28] 別のアカウントで許可して戻ると、その旨の文言が出てオフのままで、戻りの項目が住所から消える", async ({
    page,
}) => {
    test.setTimeout(90_000)
    await mockScheduleApi(page, {
        registered: false,
        completionResult: "AccountMismatch",
    })
    await page.goto("/settings/#oauthReturn=schedule&code=C&state=S")
    await expect(
        page.getByText("ログイン中とは別のアカウントで許可されたため"),
    ).toBeVisible({ timeout: 30_000 })
    await expect(scheduleSwitch(page)).not.toBeChecked()
    expect(new URL(page.url()).hash).toBe("")
})

test("[schedule-guide/AC-1 schedule-guide/AC-2] 予約投稿の説明に画像のアイコンつきの注が続き、その下に動画のアイコンつきの Chronosky のロゴとリンクがある", async ({
    page,
}) => {
    test.setTimeout(90_000)
    await mockScheduleApi(page, { registered: false })
    await page.goto("/settings/")
    // 説明文は行のラベル（予約投稿）を含む行の中にある
    const note = page
        .getByText(/日時を指定して投稿できます。/)
        .filter({ hasText: "の予約投稿のみ対応しています" })
    await expect(note).toBeVisible({ timeout: 30_000 })
    // 単語の代わりのアイコンには、読み上げ用の代替テキストがある
    await expect(note.getByRole("img", { name: "画像" })).toBeVisible()
    await expect(note.locator("img")).toHaveCount(1)

    const guide = page.getByTestId("schedule-chronosky")
    await expect(guide).toContainText("の予約投稿や、高度な機能については")
    await expect(guide.getByRole("img", { name: "動画" })).toBeVisible()
    await expect(guide.locator("img")).toHaveAttribute("src", /chronosky/)
    const link = guide.getByRole("link", { name: /Chronosky/ })
    await expect(link).toHaveAttribute("href", "https://chronosky.app/")
    await expect(link).toHaveAttribute("target", "_blank")
    await expect(link).toHaveAttribute("rel", /noopener/)
})

test("[schedule-form/AC-3] 待機中が2件と失敗が1件のときオフにすると両方の件数の確認が出て、拒否するとオン、承諾するとオフになる", async ({
    page,
}) => {
    test.setTimeout(90_000)
    const { calls } = await mockScheduleApi(page, {
        registered: true,
        items: [
            pending("a"),
            pending("b"),
            { ...pending("f"), status: "failed", lastError: "InvalidRecord" },
        ],
    })
    await page.goto("/settings/")
    const toggle = scheduleSwitch(page)
    await expect(toggle).toBeChecked({ timeout: 30_000 })

    await toggle.click({ force: true })
    const confirm = page.getByRole("dialog", { name: "予約投稿を無効にする" })
    await expect(
        confirm.getByText(
            "待機中の予約2件と、失敗した予約の履歴1件も削除されます",
        ),
    ).toBeVisible()
    await confirm.getByRole("button", { name: "キャンセル" }).click()
    await expect(toggle).toBeChecked()
    expect(calls.credentialDeletes).toBe(0)

    await toggle.click({ force: true })
    await confirm.getByRole("button", { name: "無効にする" }).click()
    await expect(toggle).not.toBeChecked()
    await expect(page.getByText("3件の予約を削除しました")).toBeVisible()
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
        await expect(dialog).toBeVisible()
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
