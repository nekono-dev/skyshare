/**
 * Verifies that a scheduled post can be enabled, created, and listed.
 * Cron execution is covered by route tests.
 */
import { expect, test } from "@playwright/test"
import { fakeRequestPaths, loginWithAppPassword } from "./support"

const TEXT = "E2E の予約投稿です"

/** Returns a datetime-local value two hours ahead, rounded to the minute. */
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

        // The fake Bluesky skips the OAuth consent screen and redirects back to enable scheduling.
        await page.goto("/settings/")
        await page.waitForLoadState("networkidle")
        // The switch input is visually hidden, so click its label.
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

        // Schedule a post for the selected date and time.
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
        // Creating a schedule does not write to fake Bluesky; Cron performs the post at its scheduled time.
        expect((await fakeRequestPaths()).slice(before)).not.toContain(
            "POST /xrpc/com.atproto.repo.applyWrites",
        )

        // The created item appears in the scheduled list without executing it.
        await page.goto("/post/")
        await page.waitForLoadState("networkidle")
        await page.getByRole("button", { name: "下書き・予約" }).click()
        await page.getByRole("tab", { name: "予約" }).click()
        await expect(page.getByTestId("schedule-list")).toContainText(TEXT)
    })
})
