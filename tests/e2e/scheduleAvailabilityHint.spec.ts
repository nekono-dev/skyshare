/**
 * 予約投稿の登録状態のヒント cookie の、ヘッドレスブラウザによる確認。
 *
 * 責務と処理概要:
 * - ヒント cookie があるページの表示では登録状態を問い合わせず、日時の指定を開いたときに問い合わせることを検証する。
 * - ヒント cookie が無いときは、1回だけ問い合わせることを検証する。
 */
import { expect, test } from "./fixtures"
import { mockScheduleApi } from "./scheduleMocks"

const hintCookie = (baseURL: string) => ({
    name: "skyshare_schedule",
    value: encodeURIComponent(
        JSON.stringify({ registered: true, reauthRequired: false }),
    ),
    url: baseURL,
})

test("[schedule-form/AC-36] ヒント cookie があるページの表示では登録状態を問い合わせず、日時の指定を開くと1回問い合わせる", async ({
    page,
    context,
    baseURL,
}) => {
    test.setTimeout(120_000)
    const { calls } = await mockScheduleApi(page, { registered: true })
    await context.addCookies([hintCookie(baseURL!)])
    await page.goto("/post/")

    const button = page.getByTestId("schedule-picker-button")
    await expect(button).toBeEnabled({ timeout: 60_000 })
    expect(calls.credentialGets).toBe(0)

    await expect(async () => {
        await button.click()
        await expect(
            page.getByRole("dialog", { name: "予約日時" }),
        ).toBeVisible({ timeout: 2_000 })
    }).toPass({ timeout: 20_000 })
    await expect.poll(() => calls.credentialGets).toBe(1)
})

test("[schedule-form/AC-36] ヒント cookie が無いときは、登録状態を1回問い合わせる", async ({
    page,
}) => {
    test.setTimeout(120_000)
    const { calls } = await mockScheduleApi(page, { registered: true })
    await page.goto("/post/")
    await expect(page.getByTestId("schedule-picker-button")).toBeEnabled({
        timeout: 60_000,
    })
    expect(calls.credentialGets).toBe(1)
})
