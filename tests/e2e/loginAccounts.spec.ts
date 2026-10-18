/**
 * ログインとアカウント切り替え（LoginForm、AccountSwitcher、AccountSwitchPanel）のヘッドレスブラウザによる確認。
 *
 * 責務と処理概要:
 * - セッションAPIの応答を差し替え、アカウントの一覧・切り替え・ログアウト・再ログインの導線・
 *   ログインの成功を検証する。
 */
import { expect, test, type Page } from "@playwright/test"

const ACCOUNTS = [
    {
        did: "did:plc:active",
        handle: "active.bsky.social",
        displayName: "アクティブ",
        isActive: true,
    },
    {
        did: "did:plc:other",
        handle: "other.bsky.social",
        displayName: "ほかのアカウント",
        isActive: false,
    },
]

const SESSION_URL = /\/v2\/bsky\/session\/?$/
const SESSION_DID_URL = /\/v2\/bsky\/session\/[^/]+\/?$/

/** セッションAPIを差し替える。呼び出された操作とボディを記録して返す */
const mockSessionApi = async (
    page: Page,
    options: { putStatus?: number; accounts?: unknown[] } = {},
) => {
    const calls: { method: string; body?: unknown; url: string }[] = []
    await page.route(SESSION_URL, route => {
        const request = route.request()
        const method = request.method()
        if (method === "GET") {
            return route.fulfill({
                contentType: "application/json",
                body: JSON.stringify({
                    accounts: options.accounts ?? ACCOUNTS,
                }),
            })
        }
        calls.push({
            method,
            url: request.url(),
            body: request.postDataJSON() ?? undefined,
        })
        if (method === "PUT") {
            return route.fulfill({ status: options.putStatus ?? 200 })
        }
        return route.fulfill({ status: 200 })
    })
    await page.route(SESSION_DID_URL, route => {
        calls.push({
            method: route.request().method(),
            url: route.request().url(),
        })
        return route.fulfill({ status: 200 })
    })
    return calls
}

test("[login-accounts/AC-1] アカウントの一覧で、アクティブなアカウントに使用中の表示が付く", async ({
    page,
}) => {
    await mockSessionApi(page)
    await page.goto("/accounts/")
    await expect(page.getByText("ほかのアカウント")).toBeVisible()
    await expect(page.getByText("使用中")).toHaveCount(1)
})

test("[login-accounts/AC-2] 使用中でないアカウントを選ぶと、そのアカウントへの切り替えが依頼される", async ({
    page,
}) => {
    test.setTimeout(90_000)
    const calls = await mockSessionApi(page)
    await page.goto("/accounts/")
    const card = page.getByText("ほかのアカウント")
    await expect(async () => {
        await card.click()
        expect(calls.some(c => c.method === "PUT")).toBe(true)
    }).toPass({ timeout: 20_000 })
    expect(calls.find(c => c.method === "PUT")?.body).toEqual({
        did: "did:plc:other",
    })
})

test("[login-accounts/AC-3] 切り替えがセッション切れで拒否されると、要再ログインの表示と再ログインの案内が出る", async ({
    page,
}) => {
    test.setTimeout(90_000)
    const calls = await mockSessionApi(page, { putStatus: 401 })
    await page.goto("/accounts/")
    const card = page.getByText("ほかのアカウント")
    await expect(async () => {
        await card.click()
        expect(calls.some(c => c.method === "PUT")).toBe(true)
    }).toPass({ timeout: 20_000 })
    await expect(page.getByText("要再ログイン")).toBeVisible()
    await expect(
        page.getByRole("heading", { name: "@other.bsky.social に再ログイン" }),
    ).toBeVisible()
    await expect(page.locator("#username")).toHaveValue("other.bsky.social")
})

test("[login-accounts/AC-4] ログアウトを押すと、そのアカウントのログアウトが依頼される", async ({
    page,
}) => {
    test.setTimeout(90_000)
    const calls = await mockSessionApi(page)
    await page.goto("/accounts/")
    const card = page
        .locator("div")
        .filter({ hasText: "ほかのアカウント" })
        .filter({ has: page.getByRole("button", { name: "ログアウト" }) })
        .last()
    await expect(async () => {
        await card.getByRole("button", { name: "ログアウト" }).click()
        expect(calls.some(c => c.method === "DELETE")).toBe(true)
    }).toPass({ timeout: 20_000 })
    expect(
        decodeURIComponent(calls.find(c => c.method === "DELETE")?.url ?? ""),
    ).toContain("did:plc:other")
})

test("[login-accounts/AC-5] 未ログインでアカウントのページを開くと、ログインのページへ遷移する", async ({
    page,
}) => {
    await page.route(SESSION_URL, route =>
        route.fulfill({
            status: 401,
            contentType: "application/json",
            body: JSON.stringify({ error: "Unauthorized" }),
        }),
    )
    await page.goto("/accounts/")
    await page.waitForURL(/\/login\/?/, { timeout: 30_000 })
})

test("[login-accounts/AC-6] ハンドルとパスワードを送信してログインに成功すると、成功の表示が出る", async ({
    page,
}) => {
    test.setTimeout(90_000)
    const calls = await mockSessionApi(page)
    await page.goto("/login/")
    await expect(page.locator("#username")).toBeVisible()
    await expect(async () => {
        await page.locator("#username").fill("me.bsky.social")
        await page.locator("#password").fill("app-password")
        await page
            .getByRole("button", { name: "ログイン", exact: true })
            .click()
        expect(calls.some(c => c.method === "POST")).toBe(true)
    }).toPass({ timeout: 20_000 })
    expect(calls.find(c => c.method === "POST")?.body).toMatchObject({
        identifier: "me.bsky.social",
        password: "app-password",
    })
    await expect(
        page.getByText("ログイン成功。リダイレクトします…"),
    ).toBeVisible()
})

test("[login-accounts/AC-7] 旧アプリのパスは、ログインのページへ転送される", async ({
    page,
}) => {
    await page.goto("/app/")
    await page.waitForURL(/\/login\/?/, { timeout: 30_000 })
})

test("[login-accounts/AC-8] ログインのページに、旧UIとゲスト表示へのリンクを含む案内が表示される", async ({
    page,
}) => {
    await page.goto("/login/")
    await expect(
        page.getByRole("link", { name: "Skyshare v1.6.3" }),
    ).toHaveAttribute("href", "/legacy/")
    await expect(page.locator('a[href="/?guest=1"]')).toBeVisible()
})
