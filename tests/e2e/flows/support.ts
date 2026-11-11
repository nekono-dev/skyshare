/**
 * Helpers for checking fake Bluesky requests and authenticated browser state in E2E flows.
 */
import type { BrowserContext } from "@playwright/test"

/** Reads the fake Bluesky origin supplied by the E2E launcher. */
export const fakeOrigin = (): string => {
    const origin = process.env.E2E_FAKE_BLUESKY_ORIGIN
    if (!origin)
        throw new Error(
            "E2E_FAKE_BLUESKY_ORIGIN is not set（npm run test:e2e で実行する）",
        )
    return origin
}

/** Returns recorded fake service requests; callers can slice around each action. */
export const fakeRequestPaths = async (): Promise<string[]> => {
    const res = await fetch(`${fakeOrigin()}/__test/requests`)
    const body = (await res.json()) as {
        requests: { method: string; path: string }[]
    }
    return body.requests.map(r => `${r.method} ${r.path}`)
}

/** Checks whether the browser context has a session cookie. */
export const hasSessionCookie = async (
    context: BrowserContext,
): Promise<boolean> =>
    (await context.cookies()).some(c => c.name === "atp_session")

import type { Page } from "@playwright/test"

/** Signs in through the app password form. */
export const loginWithAppPassword = async (
    page: Page,
    handle = "alice.test",
): Promise<void> => {
    await page.goto("/login/")
    await page.getByText("従来形式でのログイン").click()
    await page.locator("#username").fill(handle)
    await page.locator("#password").fill("app-password-fixture")
    await page.getByRole("button", { name: "ログイン", exact: true }).click()
    await page.waitForURL(/:4321\/$/)
}
