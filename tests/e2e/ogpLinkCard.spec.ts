/**
 * リンクカード（OGP）の取得（OgpFetchButton、OgpPreview）のヘッドレスブラウザによる確認。
 *
 * 責務と処理概要:
 * - 本文にURLがあるときだけ取得ボタンが表示されることを検証する。
 * - OGP抽出APIの応答を差し替え、取得の成功と失敗の表示を検証する。
 * - ログイン不要のゲスト表示（`?guest`）を使う。
 */
import { expect, test, type Page } from "@playwright/test"

// 1x1 の PNG（画像の取得先の応答として使う）
const PNG_1X1 = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
    "base64",
)

const typeBody = async (page: Page, text: string, reload = true) => {
    if (reload) await page.goto("/post/?guest", { timeout: 60_000 })
    const editor = page.locator("[data-post-body-editor]").first()
    await expect(editor).toBeVisible({ timeout: 60_000 })
    const button = page.getByRole("button", { name: "リンクカードを取得" })
    await expect(async () => {
        await editor.click()
        await page.keyboard.press("Control+A")
        await page.keyboard.press("Backspace")
        if (text) await editor.pressSequentially(text)
        await expect(button).toHaveCount(/https?:/.test(text) ? 1 : 0, {
            timeout: 2_000,
        })
    }).toPass({ timeout: 20_000 })
    return button
}

test("[ogp-link-card/AC-6] 本文にURLがあるときだけ、取得ボタンが表示される", async ({
    page,
}) => {
    test.setTimeout(90_000)
    await typeBody(page, "URLなしの本文")
    await expect(
        page.getByRole("button", { name: "リンクカードを取得" }),
    ).toHaveCount(0)
    await typeBody(page, "見てね https://example.com/page", false)
    await expect(
        page.getByRole("button", { name: "リンクカードを取得" }),
    ).toBeVisible()
})

test("[ogp-link-card/AC-7] 取得に成功すると、取得済みの表示と画像のプレビューが現れる", async ({
    page,
}) => {
    test.setTimeout(90_000)
    await page.route("**/v1/extract**", route =>
        route.fulfill({
            contentType: "application/json",
            headers: { "access-control-allow-origin": "*" },
            body: JSON.stringify({
                title: "サンプル",
                description: "説明",
                image: "https://ogp-image.example.test/og.png",
            }),
        }),
    )
    await page.route("https://ogp-image.example.test/**", route =>
        route.fulfill({
            contentType: "image/png",
            headers: { "access-control-allow-origin": "*" },
            body: PNG_1X1,
        }),
    )
    const button = await typeBody(page, "見てね https://example.com/page")
    await button.click()
    await expect(
        page.getByText("リンクカードを取得しました: https://example.com/page"),
    ).toBeVisible()
    await expect(page.getByTestId("ogp-preview")).toBeVisible()
})

test("[ogp-link-card/AC-8] 取得に失敗すると、失敗の表示が現れ、プレビューは現れない", async ({
    page,
}) => {
    test.setTimeout(90_000)
    await page.route("**/v1/extract**", route =>
        route.fulfill({
            status: 400,
            contentType: "application/json",
            headers: { "access-control-allow-origin": "*" },
            body: JSON.stringify({ error: "BadRequest" }),
        }),
    )
    const button = await typeBody(page, "見てね https://example.com/page")
    await button.click()
    await expect(
        page.getByText("リンクカード取得に失敗しました。"),
    ).toBeVisible()
    await expect(page.getByTestId("ogp-preview")).toHaveCount(0)
})
