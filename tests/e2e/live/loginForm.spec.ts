/**
 * ライブテスト: ログインフォーム（`/login/`）の確認。
 *
 * 責務と処理概要:
 * - ログイン済み状態を使わず（storageStateを空にして）、フォームへ認証情報を入力して
 *   送信し、トップへ遷移してセッションが確立されることを確認する。
 */
import { expect, test } from "../fixtures"
import { loadLiveAccount } from "./env"

test.use({ storageState: { cookies: [], origins: [] } })

test("e2elive/AC-4: ログインフォームから検証用アカウントでログインできる", async ({
    page,
}) => {
    const account = loadLiveAccount()!
    await page.goto("/login/")
    await page.locator("#username").fill(account.identifier)
    await page.locator("#password").fill(account.password)
    await page.locator("form#login-form button[type=submit]").click()

    // `**/`は`/login/`にも一致するため、パス名でトップページへの遷移を待つ
    await page.waitForURL(url => url.pathname === "/", {
        timeout: 15_000,
    })
    const res = await page.request.get("/v2/bsky/session/")
    expect(res.status()).toBe(200)
})
