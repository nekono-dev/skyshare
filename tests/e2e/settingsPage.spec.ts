/**
 * 設定ページのヘッドレスブラウザによる確認。
 *
 * 責務と処理概要:
 * - 設定ページが「表示」「投稿」「クロスポスト」の3つのグループを見出し付きで
 *   表示することを検証する。
 * - ラベル・説明文を押しても設定値が変わらず、スイッチを押したときだけ変わることを検証する。
 * - ログイン不要のゲスト表示（`?guest`）を使う。
 */
import { expect, test } from "@playwright/test"

test("[app-settings/3.1] ゲスト表示の設定ページに、3つのグループの見出しが表示される", async ({
    page,
}) => {
    test.setTimeout(90_000)
    await page.goto("/settings/?guest", { timeout: 60_000 })
    for (const name of ["表示", "投稿", "クロスポスト"]) {
        await expect(
            page.getByRole("heading", { level: 2, name, exact: true }),
        ).toBeVisible({ timeout: 60_000 })
    }
})

test("[app-settings/2.7] ラベルと説明文を押してもスイッチの状態が変わらず、スイッチを押すと変わる", async ({
    page,
}) => {
    test.setTimeout(90_000)
    await page.goto("/settings/?guest", { timeout: 60_000 })
    await page.waitForFunction(
        () => document.querySelector("astro-island[ssr]") === null,
        undefined,
        { timeout: 60_000 },
    )
    const toggle = page.getByRole("switch", { name: "ハッシュタグ候補を表示" })
    await expect(toggle).toBeChecked()

    await page.getByText("ハッシュタグ候補を表示", { exact: true }).click()
    await page.getByText(/「#」を入力した際にハッシュタグの候補一覧/).click()
    await expect(toggle).toBeChecked()

    // スイッチの見た目（入力要素に重ねたラベル）を押すと切り替わる。
    await toggle.locator("xpath=following-sibling::label").click()
    await expect(toggle).not.toBeChecked()
})
