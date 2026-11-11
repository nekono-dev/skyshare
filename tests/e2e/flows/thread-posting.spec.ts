/**
 * Verifies that a post from the composer reaches the fake Bluesky PDS.
 */
import { expect, test } from "@playwright/test"
import { fakeRequestPaths, loginWithAppPassword } from "./support"

test.describe("thread posting flow", () => {
    test("posts a text from the composer and the post reaches the PDS", async ({
        page,
    }) => {
        await loginWithAppPassword(page)
        const before = (await fakeRequestPaths()).length

        await page.goto("/post/")
        // Wait for session restoration and form loading before entering text.
        await page.waitForLoadState("networkidle")
        // Wait until the editor is ready for input.
        const body = page.locator('[contenteditable="true"]').first()
        await expect(body).toBeVisible()
        await body.click()
        await page.keyboard.type("E2E の投稿です")
        const submit = page.getByTestId("composer-submit")
        await expect(submit).toBeEnabled({ timeout: 15_000 })
        await submit.click()

        // Verify that the post API sends a write to the fake PDS.
        await expect
            .poll(async () => (await fakeRequestPaths()).slice(before), {
                timeout: 30_000,
            })
            .toContain("POST /xrpc/com.atproto.repo.applyWrites")
    })
})
