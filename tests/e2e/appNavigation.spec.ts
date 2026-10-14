/**
 * ナビゲーション（Sidebar、FooterNav）のヘッドレスブラウザによる確認。
 *
 * 責務と処理概要:
 * - デスクトップ幅でサイドバー、モバイル幅でフッターのナビが表示されること、
 *   現在地のリンクに aria-current が付くこと、ゲスト表示のクエリが引き継がれること、
 *   ログイン中のアカウントのアイコンが補われることを検証する。
 */
import { expect, test } from "@playwright/test"

test("[app-navigation/AC-8] デスクトップ幅ではサイドバーが、決まった順に表示される", async ({
    page,
}) => {
    await page.setViewportSize({ width: 1200, height: 800 })
    await page.goto("/settings/?guest")
    const nav = page.locator('[data-nav="sidebar"]')
    await expect(nav).toBeVisible()
    await expect(nav.locator("a[data-nav-key]")).toHaveCount(4)
    expect(
        await nav
            .locator("a[data-nav-key]")
            .evaluateAll(links =>
                links.map(link => link.getAttribute("data-nav-key")),
            ),
    ).toEqual(["accounts", "post", "entries", "settings"])
})

test("[app-navigation/AC-9] モバイル幅ではフッターのナビが表示され、サイドバーは隠れる", async ({
    page,
}) => {
    await page.setViewportSize({ width: 375, height: 700 })
    await page.goto("/settings/?guest")
    const footer = page.locator('[data-nav="footer"]')
    await expect(footer).toBeVisible()
    await expect(page.locator('[data-nav="sidebar"]')).toBeHidden()
    expect(
        await footer
            .locator("a[data-nav-key]")
            .evaluateAll(links =>
                links.map(link => link.getAttribute("data-nav-key")),
            ),
    ).toEqual(["entries", "post", "settings", "accounts"])
})

test("[app-navigation/AC-10] 現在のページのリンクにだけ aria-current が付く", async ({
    page,
}) => {
    await page.setViewportSize({ width: 1200, height: 800 })
    await page.goto("/settings/")
    const nav = page.locator('[data-nav="sidebar"]')
    await expect(nav.locator('a[data-nav-key="settings"]')).toHaveAttribute(
        "aria-current",
        "page",
    )
    await expect(nav.locator("a[aria-current]")).toHaveCount(1)
})

test("[app-navigation/AC-11] ゲスト表示のとき、ナビのリンクに guest のクエリが引き継がれる", async ({
    page,
}) => {
    await page.setViewportSize({ width: 1200, height: 800 })
    await page.goto("/entries/?guest")
    const link = page.locator('[data-nav="sidebar"] a[data-nav-key="settings"]')
    await expect(link).toHaveAttribute("href", "/settings/?guest=1")
})

test("[app-navigation/AC-12] ログイン中のアカウントのアイコンが、アカウントのリンクに補われる", async ({
    page,
}) => {
    await page.setViewportSize({ width: 1200, height: 800 })
    await page.route(/\/v2\/bsky\/session\/?$/, route =>
        route.fulfill({
            contentType: "application/json",
            body: JSON.stringify({
                accounts: [
                    {
                        did: "did:plc:test",
                        handle: "test.bsky.social",
                        avatarUrl: "https://avatar.example.test/a.png",
                        isActive: true,
                    },
                ],
            }),
        }),
    )
    await page.route("https://avatar.example.test/**", route =>
        route.fulfill({
            contentType: "image/png",
            body: Buffer.from(
                "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
                "base64",
            ),
        }),
    )
    await page.goto("/settings/")
    await expect(
        page
            .locator(
                '[data-nav="sidebar"] a[data-nav-key="accounts"] [data-account-avatar-img]',
            )
            .first(),
    ).toHaveAttribute("src", "https://avatar.example.test/a.png")
})
