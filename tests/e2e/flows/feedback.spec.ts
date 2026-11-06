// フィードバックの流れ（要件 10.1・10.3）: 送信フォームから不具合の報告を送ると、送信の API（/v2/feedback/）まで届き、
// 画面は API の応答を示す。GitHub の Issue の作成は検査しない（E2E では GitHub の認証情報を持たせず、
// 送信は受け付けの停止（503）になる。実際の Issue は作らない）
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
        // 送信の API が呼ばれ、応答（E2E では受け付けの停止）が画面に出る
        expect((await sent).status()).toBe(503)
        await expect(page.getByRole("alert")).toContainText(
            "ただいま受け付けを停止しています",
        )
    })
})
