// E2E の流れのテスト用の支援（テストファイルではない）
// 偽の Bluesky の要求の記録を読み、画面の操作と API の呼び出しが結線されていることを確かめる。
import type { BrowserContext } from "@playwright/test"

/** 起動スクリプトが偽の Bluesky の origin を環境変数で渡す */
export const fakeOrigin = (): string => {
    const origin = process.env.E2E_FAKE_BLUESKY_ORIGIN
    if (!origin)
        throw new Error(
            "E2E_FAKE_BLUESKY_ORIGIN is not set（npm run test:e2e で実行する）",
        )
    return origin
}

/** 偽の Bluesky が受けた経路（記録の先頭から）。テストの間で区別するため、呼ぶ前後の差を使う */
export const fakeRequestPaths = async (): Promise<string[]> => {
    const res = await fetch(`${fakeOrigin()}/__test/requests`)
    const body = (await res.json()) as {
        requests: { method: string; path: string }[]
    }
    return body.requests.map(r => `${r.method} ${r.path}`)
}

/** ログイン後の session の Cookie があるか */
export const hasSessionCookie = async (
    context: BrowserContext,
): Promise<boolean> =>
    (await context.cookies()).some(c => c.name === "atp_session")

import type { Page } from "@playwright/test"

/** アプリパスワードでログインする（ログインの流れの検査で確かめた操作と同じ） */
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
