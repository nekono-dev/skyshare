/**
 * APIエラーの表示文言（.kiro/specs/api-error-message）のヘッドレスブラウザによる動作確認。
 *
 * 責務と処理概要:
 * - ログイン時の通信失敗で、接続できない旨の文言が表示されることを確認する。
 * - タイムラインの取得失敗で、サーバーのエラー文字列ではなく読み込み失敗の文言が表示されることを確認する。
 * - ステータスごとの文言の対応（409・500）は`i18n.spec.ts`で確認する。
 */
import { expect, test } from "@playwright/test"
import { openPasswordLogin } from "./fixtures"

test("[api-error-message/2.4] ログイン時に通信が失敗すると、接続できない旨の文言が表示される", async ({
    page,
}) => {
    test.setTimeout(90_000)
    await page.route(/\/v2\/bsky\/session\/?$/, route =>
        route.request().method() === "POST"
            ? route.abort("connectionrefused")
            : route.continue(),
    )
    await page.goto("/login/", { timeout: 60_000 })
    const form = page.locator("#login-form")
    await expect(form).toBeVisible({ timeout: 60_000 })
    // アプリパスワードのフォームは折りたたまれているため開く
    await openPasswordLogin(form)
    await form.locator("#username").fill("someone.bsky.social")
    await form.locator("#password").fill("password")
    await expect(async () => {
        await form.locator('button[type="submit"]').click()
        await expect(page.locator("#message")).toHaveText(
            "サーバへ接続できませんでした。",
            { timeout: 2_000 },
        )
    }).toPass({ timeout: 20_000 })
})

test("[api-error-message/4.1] タイムラインの取得に失敗すると、サーバーのエラー文字列ではなく読み込み失敗の文言が表示される", async ({
    page,
}) => {
    test.setTimeout(90_000)
    await page.route(/\/v2\/entries\/?(\?.*)?$/, route =>
        route.fulfill({
            status: 500,
            contentType: "application/json",
            body: JSON.stringify({ error: "RAW_SERVER_ERROR_STRING" }),
        }),
    )
    await page.goto("/", { timeout: 60_000 })
    await expect(page.getByText("投稿一覧の取得に失敗しました。")).toBeVisible({
        timeout: 60_000,
    })
    await expect(page.getByText("RAW_SERVER_ERROR_STRING")).toHaveCount(0)
})
