/**
 * Verifies that a bug report reaches the feedback API and its response appears.
 * GitHub issue creation is disabled in E2E, so the API responds with 503.
 */
import { expect, test } from "@playwright/test"
import { loginWithAppPassword } from "./support"

test.describe("feedback flow", () => {
    test("sends a bug report up to the feedback API", async ({ page }) => {
        await loginWithAppPassword(page)
        await page.goto("/feedback/")
        await page.waitForLoadState("networkidle")

        const form = page.getByTestId("feedback-form")
        await expect(form).toBeVisible()
        await form.getByText("不具合の報告", { exact: true }).click()
        await page.locator("#feedback-title").fill("E2E の不具合の報告です")
        await page.locator("#feedback-steps").fill("投稿フォームを開いた")
        await form.getByText("毎回起きる", { exact: true }).click()

        const sent = page.waitForResponse(
            res =>
                res.url().endsWith("/v2/feedback/") &&
                res.request().method() === "POST",
        )
        await form.getByRole("button", { name: "送信する" }).click()
        // The API response appears in the page; E2E returns 503 because submissions are disabled.
        expect((await sent).status()).toBe(503)
        await expect(page.getByRole("alert")).toContainText(
            "ただいま受け付けを停止しています",
        )
    })
})
