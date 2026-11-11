/**
 * Verifies that a submitted survey answer is saved and hides the entry point.
 * Answer anonymization is covered by route tests.
 */
import { expect, test } from "@playwright/test"
import { loginWithAppPassword } from "./support"

// Identifies the open survey fixture used by this flow.
const SURVEY_ID = "e2e-open"

test.describe("survey flow", () => {
    test("answers the survey from the composer and the answer is kept", async ({
        page,
    }) => {
        await loginWithAppPassword(page)
        await page.goto("/")
        await page.waitForLoadState("networkidle")

        await page
            .getByRole("button", { name: "アンケートにご協力ください" })
            .click()
        const dialog = page.getByRole("dialog")
        await expect(dialog).toBeVisible()
        await dialog.getByText("毎日", { exact: true }).click()
        await dialog.getByText("投稿の共有", { exact: true }).click()

        const saved = page.waitForResponse(
            res =>
                res.url().includes(`/v2/surveys/${SURVEY_ID}/answers/`) &&
                res.request().method() === "POST",
        )
        await dialog.getByRole("button", { name: "送信する" }).click()
        expect((await saved).status()).toBe(201)
        await expect(dialog).toBeHidden()

        // A saved answer hides the entry point after reload.
        await page.reload()
        await page.waitForLoadState("networkidle")
        await expect(
            page.getByRole("button", { name: "アンケートにご協力ください" }),
        ).toHaveCount(0)
    })
})
