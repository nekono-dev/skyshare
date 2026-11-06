// 予約投稿の流れ（要件 10.1・10.2・10.3）: 設定で予約投稿を有効にし（OAuth の認可を偽の Bluesky で通す）、
// 投稿フォームで予約日時を指定して予約すると、予約の一覧に表示される。予約の実行は検査しない（route 層で検証する）
import { expect, test } from "@playwright/test"
import { fakeRequestPaths, loginWithAppPassword } from "./support"

const TEXT = "E2E の予約投稿です"

/** 予約の日時（分まで）。入力欄（datetime-local）の書式に合わせる。現在から2時間後 */
const runAtInput = (): string => {
    const d = new Date(Date.now() + 2 * 60 * 60 * 1000)
    const pad = (n: number) => String(n).padStart(2, "0")
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

test.describe("schedule flow", () => {
    test("enables scheduling, schedules a post, and lists it", async ({
        page,
    }) => {
        await loginWithAppPassword(page)
        const before = (await fakeRequestPaths()).length

        // 予約の認可（OAuth）。認可の画面は偽の Bluesky が省略し、戻りの画面で有効になる
        await page.goto("/settings/")
        await page.waitForLoadState("networkidle")
        // スイッチの入力は視覚的に隠れているため、ラベルを押して切り替える
        await page.locator('label[for="setting-scheduledPost"]').click()
        await page
            .getByTestId("schedule-credential-dialog")
            .getByRole("button", { name: "認証する" })
            .click()
        await expect(
            page.getByRole("switch", { name: "予約投稿" }),
        ).toBeChecked({
            timeout: 30_000,
        })

        // 投稿フォームで日時を指定して予約する
        await page.goto("/post/")
        await page.waitForLoadState("networkidle")
        const body = page.locator('[contenteditable="true"]').first()
        await expect(body).toBeVisible()
        await body.click()
        await page.keyboard.type(TEXT)
        await page.getByTestId("schedule-picker-button").click()
        await page.locator('input[type="datetime-local"]').fill(runAtInput())
        await page.getByRole("button", { name: "設定", exact: true }).click()
        await expect(page.getByTestId("schedule-run-at-label")).toBeVisible()

        const scheduled = page.waitForResponse(
            res =>
                res.url().endsWith("/v2/schedules/") &&
                res.request().method() === "POST",
        )
        await page.getByRole("button", { name: "予約", exact: true }).click()
        expect((await scheduled).status()).toBe(200)
        // 予約の作成は、偽の Bluesky へ書き込まない（実行は予約の時刻に Cron が行い、ここでは検査しない）
        expect((await fakeRequestPaths()).slice(before)).not.toContain(
            "POST /xrpc/com.atproto.repo.applyWrites",
        )

        // 予約の一覧（下書き・予約の「予約」の表示）に、作成した予約が表示される（実行はされない）
        await page.goto("/post/")
        await page.waitForLoadState("networkidle")
        await page.getByRole("button", { name: "下書き・予約" }).click()
        await page.getByRole("tab", { name: "予約" }).click()
        await expect(page.getByTestId("schedule-list")).toContainText(TEXT)
    })
})
