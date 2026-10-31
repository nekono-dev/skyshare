// スレッド投稿の流れ（要件 10.1・10.3・10.4）: ログイン後に投稿フォームから投稿でき、
// 投稿は偽の Bluesky の PDS の書き込み（applyWrites）まで届く。実アカウントは使わない
import { expect, test } from "@playwright/test"
import { fakeRequestPaths, loginWithAppPassword } from "./support"

test.describe("thread posting flow", () => {
    test("posts a text from the composer and the post reaches the PDS", async ({
        page,
    }) => {
        await loginWithAppPassword(page)
        const before = (await fakeRequestPaths()).length

        await page.goto("/post/")
        // 画面の初期化（セッションの復元とフォームの読み込み）が落ち着いてから入力する
        await page.waitForLoadState("networkidle")
        // 入力欄が操作できる（画面の読み込みとセッションの復元が済んだ）ことを待つ
        const body = page.locator('[contenteditable="true"]').first()
        await expect(body).toBeVisible()
        await body.click()
        await page.keyboard.type("E2E の投稿です")
        const submit = page.getByTestId("composer-submit")
        await expect(submit).toBeEnabled({ timeout: 15_000 })
        await submit.click()

        // 投稿の API（サーバー）が、偽の PDS へ書き込みを送ったことを確かめる
        await expect
            .poll(async () => (await fakeRequestPaths()).slice(before), {
                timeout: 30_000,
            })
            .toContain("POST /xrpc/com.atproto.repo.applyWrites")
    })
})
