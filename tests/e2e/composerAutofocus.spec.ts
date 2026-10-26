/**
 * 投稿ボタンで開く投稿フォームの、本文の入力欄への自動フォーカスのヘッドレスブラウザによる確認。
 *
 * 責務と処理概要:
 * - ゲスト表示（`?guest`）で投稿フォームを固定表示しない設定にし、投稿ボタンで開く投稿フォームを使う。
 * - 開いた直後に、入力欄をクリックせずキーボードで入力した文字が本文に入ることを検証する。
 * - 閉じて開き直しても、再びフォーカスされることを検証する。
 */
import type { Page } from "@playwright/test"
import { expect, test } from "./fixtures"

/** Astro のアイランドがすべてハイドレーションされるまで待つ */
const waitHydrated = async (page: Page) => {
    await page.waitForFunction(
        () => document.querySelector("astro-island[ssr]") === null,
    )
}

const editorLocator = (page: Page) =>
    page.locator("[data-post-body-editor]").first()

test.beforeEach(async ({ page }) => {
    // 投稿フォームを固定表示しない設定にして、投稿ボタンのモーダルだけが投稿フォームになるようにする
    await page.addInitScript(() => {
        window.localStorage.setItem("pinnedFormDisabled", "true")
    })
    await page.goto("/?guest")
    await waitHydrated(page)
})

test("[composer-autofocus/AC-1] 投稿ボタンで開くと入力欄にフォーカスがあり、クリックせずに入力できる", async ({
    page,
}) => {
    await page.getByRole("button", { name: "新規投稿" }).first().click()
    const editor = editorLocator(page)
    await expect(editor).toBeVisible()
    await expect(editor).toBeFocused()

    await page.keyboard.type("自動フォーカスの確認")
    await expect(editor).toContainText("自動フォーカスの確認")
})

test("[composer-autofocus/AC-2] 閉じて開き直しても入力欄にフォーカスがある", async ({
    page,
}) => {
    const launcher = page.getByRole("button", { name: "新規投稿" }).first()
    await launcher.click()
    await expect(editorLocator(page)).toBeFocused()

    await page.getByRole("button", { name: "キャンセル" }).click()
    await expect(editorLocator(page)).toHaveCount(0)

    await launcher.click()
    await expect(editorLocator(page)).toBeFocused()
})

test("[composer-autofocus/AC-3] スクロールした状態で開いても、背面の固定位置と閉じた後のスクロール位置が変わらない", async ({
    page,
}) => {
    // スクロールできる高さを確保してから、下へスクロールする
    await page.evaluate(() => {
        document.body.style.minHeight = "3000px"
        window.scrollTo(0, 400)
    })
    const before = await page.evaluate(() => window.scrollY)
    expect(before).toBeGreaterThan(0)

    await page.getByRole("button", { name: "新規投稿" }).first().click()
    await expect(editorLocator(page)).toBeFocused()
    // 開いている間は背面が固定され window.scrollY は 0 になるため、固定位置（body の top）で見る
    expect(await page.evaluate(() => document.body.style.top)).toBe(
        `-${before}px`,
    )

    // 閉じたあとは、開く前のスクロール位置へ戻る
    await page.getByRole("button", { name: "キャンセル" }).click()
    await expect(editorLocator(page)).toHaveCount(0)
    expect(await page.evaluate(() => window.scrollY)).toBe(before)
})
