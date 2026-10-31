// ログインの流れ（要件 10.1）: アプリパスワードと OAuth のどちらでも、画面からログインでき、
// 偽の Bluesky の認可・セッションの経路を通って、セッションの Cookie が発行される
import { expect, test } from "@playwright/test"
import { fakeRequestPaths, hasSessionCookie } from "./support"

test.describe("login flow", () => {
    test("logs in with an app password through the login form", async ({
        page,
        context,
    }) => {
        const before = (await fakeRequestPaths()).length
        await page.goto("/login/")
        await page.getByText("従来形式でのログイン").click()
        await page.locator("#username").fill("alice.test")
        await page.locator("#password").fill("app-password-fixture")
        await page
            .getByRole("button", { name: "ログイン", exact: true })
            .click()
        await expect(page).toHaveURL(/:4321\/$/)
        expect(await hasSessionCookie(context)).toBe(true)
        const called = (await fakeRequestPaths()).slice(before)
        expect(called).toContain("POST /xrpc/com.atproto.server.createSession")
    })

    test("logs in with OAuth through the authorization server", async ({
        page,
        context,
    }) => {
        const before = (await fakeRequestPaths()).length
        await page.goto("/login/")
        await page.getByRole("button", { name: "Bluesky でログイン" }).click()
        await expect(page).toHaveURL(/:4321\/$/, { timeout: 30_000 })
        expect(await hasSessionCookie(context)).toBe(true)
        const called = (await fakeRequestPaths()).slice(before)
        expect(called).toEqual(
            expect.arrayContaining([
                "POST /oauth/par",
                "GET /oauth/authorize",
                "POST /oauth/token",
            ]),
        )
    })
})
