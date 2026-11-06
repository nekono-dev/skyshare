// アンケートの流れ（要件 10.1・10.3）: タイムラインの下の入口からアンケートを開き、回答を送信すると、
// 回答が保存され（API が保存を返し）、再読み込み後は入口が出ない。回答の内容は検査しない（匿名化は route 層で検査）
import { expect, test } from "@playwright/test"
import { loginWithAppPassword } from "./support"

// 検証用の設定（tests/fixtures/survey/e2e-open.json）の識別子
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

        // 保存されたため、再読み込み後は入口が出ない
        await page.reload()
        await page.waitForLoadState("networkidle")
        await expect(
            page.getByRole("button", { name: "アンケートにご協力ください" }),
        ).toHaveCount(0)
    })
})
